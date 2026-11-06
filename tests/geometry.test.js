import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAIN_TRACK, PLAYER_CONFIG, SAFE_TRACK_INDICES, getHomeLane, getBaseSlots,
  getTrackCell, isSafeTrackIndex, assertBoardGeometry,
} from '../src/geometry.js';
import { getStackLayout } from '../src/stack-layout.js';

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
  assert.equal(result.positions.length, 4);
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
    green: 0, blue: 13, red: 26, yellow: 39,
  });
});