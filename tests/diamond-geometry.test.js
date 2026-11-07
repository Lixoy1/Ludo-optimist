import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIAMOND_GEOMETRY, assertDiamondGeometry, getDiamondStackLayout } from '../src/diamond-geometry.js';

const COLORS = ['green', 'red', 'blue', 'yellow'];
const themes = ['classic', 'neon', 'elite', 'marble'];
const asset = (theme) => readFileSync(resolve('assets/boards', `optimist-ludo-diamond-${theme}.svg`), 'utf8');

test('DIAMOND geometry is complete and has 52 route nodes, four arms and eight safe cells', () => {
  const geometry = DIAMOND_GEOMETRY;
  assert.equal(assertDiamondGeometry(), true);
  assert.equal(geometry.track.length, 52);
  assert.equal(geometry.arms.length, 4);
  assert.deepEqual(geometry.safeIndices, [0, 6, 13, 19, 26, 32, 39, 45]);
  assert.equal(new Set(geometry.track.map((point) => point.index)).size, 52);
});

test('DIAMOND coordinates exactly match indexed route, base, home and finish circles in artwork', () => {
  const svg = asset('neon');
  const point = (id) => {
    const match = svg.match(new RegExp(`<circle id="${id}" cx="([0-9.]+)" cy="([0-9.]+)"`));
    assert.ok(match, `Missing SVG marker ${id}`);
    return { x: Number(match[1]), y: Number(match[2]) };
  };
  for (let index = 0; index < 52; index += 1) {
    assert.deepEqual(DIAMOND_GEOMETRY.track[index], { ...point('t' + index), index });
  }
  for (const arm of DIAMOND_GEOMETRY.arms) {
    const color = arm.player.id;
    assert.equal(arm.homeLane.length, 5);
    assert.equal(arm.baseSlots.length, 4);
    assert.equal(arm.finishSlots.length, 4);
    arm.homeLane.forEach((p, index) => assert.deepEqual(p, point('h' + color + index)));
    arm.baseSlots.forEach((p, index) => assert.deepEqual(p, point('b' + color + index)));
    arm.finishSlots.forEach((p, index) => assert.deepEqual(p, point('f' + color + index)));
    assert.ok(DIAMOND_GEOMETRY.safeIndices.includes(arm.startIndex));
    assert.ok(DIAMOND_GEOMETRY.safeIndices.includes(arm.starIndex));
  }
});

test('DIAMOND safe cells match the four star markers and four coloured start cells', () => {
  const svg = asset('neon');
  for (const index of [0, 13, 26, 39]) assert.match(svg, new RegExp(`<polygon id="s${index}"`));
  const expectedStarts = { red: 6, blue: 19, yellow: 32, green: 45 };
  for (const arm of DIAMOND_GEOMETRY.arms) {
    assert.equal(arm.startIndex, expectedStarts[arm.player.id]);
    assert.equal(arm.homeEntryIndex, (arm.startIndex + 51) % 52);
  }
});

test('DIAMOND original circular route distances are within measured short and diagonal steps', () => {
  const route = DIAMOND_GEOMETRY.track;
  const steps = route.map((point, index) => {
    const next = route[(index + 1) % route.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  assert.ok(Math.abs(Math.min(...steps) - DIAMOND_GEOMETRY.minTrackPitch) < .02);
  assert.ok(Math.abs(Math.max(...steps) - DIAMOND_GEOMETRY.maxTrackPitch) < .02);
  assert.ok(steps.every((step) => step >= 21.3 && step <= 30.3));
});

test('DIAMOND four-pawn stacks stay inside the route tile and do not overlap', () => {
  const layout = getDiamondStackLayout(4);
  assert.equal(layout.tokens.length, 4);
  assert.equal(layout.hiddenCount, 0);
  const diameter = DIAMOND_GEOMETRY.pawnDiameter * layout.tokens[0].scale;
  const centers = layout.tokens.map((token) => ({ x: token.x, y: token.y }));
  for (let a = 0; a < centers.length; a += 1) {
    for (let b = a + 1; b < centers.length; b += 1) {
      assert.ok(Math.hypot(centers[a].x - centers[b].x, centers[a].y - centers[b].y) > diameter);
    }
  }
  const minX = Math.min(...centers.map((p) => p.x - diameter / 2));
  const maxX = Math.max(...centers.map((p) => p.x + diameter / 2));
  const minY = Math.min(...centers.map((p) => p.y - diameter / 2));
  const maxY = Math.max(...centers.map((p) => p.y + diameter / 2));
  assert.ok(maxX - minX < DIAMOND_GEOMETRY.tileSize);
  assert.ok(maxY - minY < DIAMOND_GEOMETRY.tileSize);
});

test('all four DIAMOND surface themes retain the same complete geometry markers', () => {
  for (const theme of themes) {
    const svg = asset(theme);
    assert.match(svg, /width="720" height="720" viewBox="0 0 720 720"/);
    for (let index = 0; index < 52; index += 1) assert.match(svg, new RegExp(`<circle id="t${index}"`));
    for (const color of COLORS) {
      for (let index = 0; index < 4; index += 1) assert.match(svg, new RegExp(`<circle id="b${color}${index}"`));
      for (let index = 0; index < 5; index += 1) assert.match(svg, new RegExp(`<circle id="h${color}${index}"`));
      for (let index = 0; index < 4; index += 1) assert.match(svg, new RegExp(`<circle id="f${color}${index}"`));
    }
  }
});
