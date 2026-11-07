import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAIN_TRACK, PLAYER_CONFIG, SAFE_TRACK_INDICES, getHomeLane, getBaseSlots,
  getTrackCell, isSafeTrackIndex, assertBoardGeometry,
} from '../src/geometry.js';
import { getStackLayout } from '../src/stack-layout.js';
import {
  BOARD_IMAGE_SIZE, PAWN_DIAMETER_RATIO, BASE_SLOT_POINTS, FINISH_POINTS, gridToImage,
} from '../src/board-render.js';


const CLASSIC_TILE_SIZE = 38; // scripts/build-board-assets.mjs
const CLASSIC_PAWN_RADIUS = BOARD_IMAGE_SIZE * PAWN_DIAMETER_RATIO / 2;
function circleOverlapsClassicTile(circle, cell, size = CLASSIC_TILE_SIZE) {
  const center = gridToImage(cell.col, cell.row);
  const nearestX = Math.max(center.x-size/2, Math.min(center.x+size/2, circle.x));
  const nearestY = Math.max(center.y-size/2, Math.min(center.y+size/2, circle.y));
  return Math.hypot(circle.x-nearestX, circle.y-nearestY) < circle.radius - 1e-6;
}
function circlesOverlap(a,b) {
  return Math.hypot(a.x-b.x,a.y-b.y) < a.radius+b.radius-1e-6;
}

test('classic outer route has 52 unique in-bounds cells', () => {
  assert.equal(assertBoardGeometry(), true);
  assert.equal(MAIN_TRACK.length, 52);
  assert.equal(new Set(MAIN_TRACK.map(({ col, row }) => `${col},${row}`)).size, 52);
  for (const cell of MAIN_TRACK) {
    assert.ok(cell.col >= 0 && cell.col < 15);
    assert.ok(cell.row >= 0 && cell.row < 15);
  }
});

test('four players have five approach cells and four home wells each', () => {
  for (const color of Object.keys(PLAYER_CONFIG)) {
    assert.equal(getHomeLane(color).length, 5);
    assert.equal(getBaseSlots(color).length, 4);
  }
});

test('safe track cells include the four player start squares and four star squares', () => {
  assert.equal(SAFE_TRACK_INDICES.size, 8);
  for (const index of [0, 8, 13, 21, 26, 34, 39, 47]) assert.equal(isSafeTrackIndex(index), true);
  assert.equal(isSafeTrackIndex(1), false);
});

test('track lookup rejects invalid positions', () => {
  assert.equal(getTrackCell(0).index, 0);
  assert.throws(() => getTrackCell(-1), RangeError);
  assert.throws(() => getTrackCell(52), RangeError);
});

test('one to four tokens receive compact deterministic positions', () => {
  assert.equal(getStackLayout(1).positions.length, 1);
  assert.equal(getStackLayout(2).positions.length, 2);
  assert.equal(getStackLayout(3).positions.length, 3);
  assert.equal(getStackLayout(4).positions.length, 4);
  assert.equal(getStackLayout(4).hiddenCount, 0);
  assert.equal(new Set(getStackLayout(4).positions.map(({ x, y }) => `${x},${y}`)).size, 4);
});

test('crowded squares keep four visible tokens and report overflow', () => {
  const result = getStackLayout(6);
  assert.equal(result.positions.length, 6);
  assert.equal(result.positions.filter((position) => position.visible).length, 4);
  assert.equal(result.positions.filter((position) => !position.visible).length, 2);
  assert.equal(result.hiddenCount, 2);
});

test('stack layout validates its inputs', () => {
  assert.throws(() => getStackLayout(-1), RangeError);
  assert.throws(() => getStackLayout(1, 0), RangeError);
});


test('each home lane is oriented from its own entry side toward the shared center', () => {
  const expected = {
    green: [[1,7],[2,7],[3,7],[4,7],[5,7]],
    blue: [[7,1],[7,2],[7,3],[7,4],[7,5]],
    red: [[13,7],[12,7],[11,7],[10,7],[9,7]],
    yellow: [[7,13],[7,12],[7,11],[7,10],[7,9]],
  };
  for (const [color, cells] of Object.entries(expected)) {
    assert.deepEqual(PLAYER_CONFIG[color].lane, cells);
  }
});

test('home lanes do not reuse outer-track cells or each other', () => {
  const outer = new Set(MAIN_TRACK.map(({ col, row }) => `${col},${row}`));
  const seen = new Set();
  for (const color of Object.keys(PLAYER_CONFIG)) {
    for (const cell of getHomeLane(color)) {
      const key = `${cell.col},${cell.row}`;
      assert.equal(outer.has(key), false, `home lane overlaps outer track at ${key}`);
      assert.equal(seen.has(key), false, `home lanes overlap at ${key}`);
      seen.add(key);
    }
  }
  assert.equal(seen.size, 20);
});


test('player bases and start squares match the supplied OPTIMIST LUDO artwork', () => {
  assert.deepEqual(PLAYER_CONFIG.blue.base, { col: 0, row: 0 });
  assert.deepEqual(PLAYER_CONFIG.red.base, { col: 9, row: 0 });
  assert.deepEqual(PLAYER_CONFIG.green.base, { col: 0, row: 9 });
  assert.deepEqual(PLAYER_CONFIG.yellow.base, { col: 9, row: 9 });
  assert.deepEqual(Object.fromEntries(Object.entries(PLAYER_CONFIG).map(([color, config]) => [color, config.start])), {
    blue: 0, red: 13, yellow: 26, green: 39,
  });
});

test('Classic outer route has 48 orthogonal steps and four explicit diagonal corner connectors', () => {
  const lengths = MAIN_TRACK.map((cell,index) => {
    const next = MAIN_TRACK[(index+1)%MAIN_TRACK.length];
    return Math.hypot(next.col-cell.col,next.row-cell.row);
  });
  assert.equal(lengths.filter(value => Math.abs(value-1)<1e-8).length,48);
  assert.equal(lengths.filter(value => Math.abs(value-Math.SQRT2)<1e-8).length,4);
  assert.ok(lengths.every(value => Math.abs(value-1)<1e-8 || Math.abs(value-Math.SQRT2)<1e-8));
});

test('Classic home-lane entrances connect to their own final outer cells', () => {
  for (const color of Object.keys(PLAYER_CONFIG)) {
    const config = PLAYER_CONFIG[color];
    const entry = MAIN_TRACK[config.homeEntry];
    const first = config.lane[0];
    const distance = Math.hypot(first[0]-entry.col,first[1]-entry.row);
    assert.ok(Math.abs(distance-1)<1e-8 || Math.abs(distance-Math.SQRT2)<1e-8);
    for (let index=1;index<config.lane.length;index++) {
      const previous=config.lane[index-1],current=config.lane[index];
      assert.equal(Math.hypot(current[0]-previous[0],current[1]-previous[1]),1);
    }
  }
});

test('Classic route and home tile footprints do not overlap at their rendered 38px size', () => {
  const route=MAIN_TRACK.map(cell=>({id:'track '+cell.index,cell}));
  const home=Object.entries(PLAYER_CONFIG).flatMap(([color,config])=>config.lane.map(([col,row],index)=>({
    id:'home '+color+':'+index,cell:{col,row}
  })));
  const all=[...route,...home];
  for(let a=0;a<all.length;a++)for(let b=a+1;b<all.length;b++) {
    const pa=gridToImage(all[a].cell.col,all[a].cell.row);
    const pb=gridToImage(all[b].cell.col,all[b].cell.row);
    assert.ok(Math.abs(pa.x-pb.x)>=CLASSIC_TILE_SIZE-1e-6 ||
      Math.abs(pa.y-pb.y)>=CLASSIC_TILE_SIZE-1e-6,
      all[a].id+' overlaps '+all[b].id);
  }
});

test('Classic base and finish pawn circles clear all route and home tile footprints', () => {
  const tiles=[
    ...MAIN_TRACK,
    ...Object.values(PLAYER_CONFIG).flatMap(config=>config.lane.map(([col,row])=>({col,row})))
  ];
  const baseCircles=Object.values(BASE_SLOT_POINTS).flat().map(([x,y])=>({x,y,radius:CLASSIC_PAWN_RADIUS}));
  const finishCircles=FINISH_POINTS.map(([x,y])=>({x,y,radius:CLASSIC_PAWN_RADIUS}));
  for(const circle of [...baseCircles,...finishCircles]) {
    for(const cell of tiles) assert.equal(circleOverlapsClassicTile(circle,cell),false);
    assert.ok(circle.x-circle.radius>=0&&circle.y-circle.radius>=0);
    assert.ok(circle.x+circle.radius<=BOARD_IMAGE_SIZE&&circle.y+circle.radius<=BOARD_IMAGE_SIZE);
  }
  for(let a=0;a<baseCircles.length;a++)for(let b=a+1;b<baseCircles.length;b++) {
    assert.equal(circlesOverlap(baseCircles[a],baseCircles[b]),false);
  }
  for(let a=0;a<finishCircles.length;a++)for(let b=a+1;b<finishCircles.length;b++) {
    assert.equal(circlesOverlap(finishCircles[a],finishCircles[b]),false);
  }
  for(const base of baseCircles)for(const finish of finishCircles) {
    assert.equal(circlesOverlap(base,finish),false);
  }
});
