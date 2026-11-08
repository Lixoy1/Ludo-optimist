import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EXTENDED_GEOMETRIES, assertExtendedGeometry, distance, getExtendedStackLayout,
  renderExtendedBoardSvg,
} from '../src/extended-geometries.js';

const geometry = EXTENDED_GEOMETRIES.hexa;
const themes = ['classic', 'neon'];
const asset = (theme) => readFileSync(
  resolve('assets/boards', 'optimist-ludo-hexa-' + theme + '.svg'), 'utf8'
);

test('HEXA keeps its canonical six-player route and home-lane counts', () => {
  assert.deepEqual({
    sides: geometry.sides, players: geometry.maxPlayers, track: geometry.trackLength,
    outer: geometry.maxOuterSteps, home: geometry.homeCells, finish: geometry.finishStep,
    safe: geometry.safeIndices.length,
  }, { sides: 6, players: 6, track: 72, outer: 71, home: 6, finish: 78, safe: 12 });
  assert.deepEqual(Object.keys(EXTENDED_GEOMETRIES), ['hexa']);
  assert.equal(assertExtendedGeometry(geometry), true);
});

test('HEXA outer route is continuous, unique, and closes at exactly one cell pitch', () => {
  assert.equal(geometry.track.length, 72);
  assert.equal(new Set(geometry.track.map(cell => cell.index)).size, 72);
  assert.equal(new Set(geometry.track.map(cell => cell.nativeX + ',' + cell.nativeY)).size, 72);
  for (let index = 0; index < 72; index += 1) {
    assert.ok(Math.abs(distance(geometry.track[index], geometry.track[(index + 1) % 72]) - geometry.cellPitch) < .03);
  }
});

test('six home lanes connect to their entries and have six consecutive cells each', () => {
  assert.equal(geometry.arms.length, 6);
  for (const arm of geometry.arms) {
    assert.equal(arm.homeLane.length, 6);
    assert.equal(arm.homeEntryIndex, (arm.startIndex + geometry.maxOuterSteps) % geometry.trackLength);
    assert.ok(geometry.safeIndices.includes(arm.startIndex));
    assert.ok(geometry.safeIndices.includes(arm.starIndex));
    const entry = geometry.track[arm.homeEntryIndex];
    assert.ok(Math.abs(distance(entry, arm.homeLane[0]) - geometry.cellPitch) < .03);
    for (let index = 0; index < 5; index += 1) {
      assert.ok(Math.abs(distance(arm.homeLane[index], arm.homeLane[index + 1]) - geometry.cellPitch) < .03);
    }
  }
});

test('HEXA pawn diameter is exactly 64 percent of logical cell pitch', () => {
  assert.ok(Math.abs(geometry.pawnDiameter / geometry.cellPitch - .64) < 1e-8);
});

test('every player has four separate base anchors and four finish anchors', () => {
  for (const arm of geometry.arms) {
    assert.equal(arm.baseSlots.length, 4);
    assert.equal(arm.finishSlots.length, 4);
    for (let a = 0; a < 4; a += 1) for (let b = a + 1; b < 4; b += 1) {
      assert.ok(distance(arm.baseSlots[a], arm.baseSlots[b]) > geometry.pawnDiameter * .98);
      assert.ok(distance(arm.finishSlots[a], arm.finishSlots[b]) >
        geometry.pawnDiameter * geometry.finishPawnScale * .98);
    }
  }
});

test('four-token stacks remain within one tile footprint', () => {
  const four = getExtendedStackLayout('hexa', 4);
  assert.equal(four.tokens.length, 4);
  assert.equal(four.tokens.filter(token => token.visible).length, 4);
  assert.equal(four.hiddenCount, 0);
  const tokens = four.tokens;
  const spanX = Math.max(...tokens.map(token => token.x + token.diameter / 2))
    - Math.min(...tokens.map(token => token.x - token.diameter / 2));
  const spanY = Math.max(...tokens.map(token => token.y + token.diameter / 2))
    - Math.min(...tokens.map(token => token.y - token.diameter / 2));
  assert.ok(spanX < geometry.tileSize);
  assert.ok(spanY < geometry.tileSize);
});

test('two HEXA theme assets expose identical geometry and empty pawn wells', () => {
  for (const theme of themes) {
    const svg = asset(theme);
    assert.match(svg, /width="720" height="720" viewBox="0 0 720 720"/);
    assert.equal((svg.match(/data-track-cell=/g) || []).length, 72);
    assert.equal((svg.match(/data-home-cell=/g) || []).length, 36);
    assert.equal((svg.match(/data-base-slot=/g) || []).length, 24);
    assert.equal((svg.match(/data-finish-slot=/g) || []).length, 24);
    assert.equal((svg.match(/data-safe-cell=/g) || []).length, 12);
    assert.doesNotMatch(svg, /data-avatar=|<image id="avatar-/);
    assert.match(svg, /OPTIMIST/);
    assert.match(svg, /LUDO/);
  }
});

test('runtime HEXA art preserves logical cell count and leaves base wells empty', () => {
  for (const theme of themes) {
    const svg = renderExtendedBoardSvg(geometry, theme);
    assert.equal((svg.match(/data-track-cell=/g) || []).length, 72);
    assert.equal((svg.match(/data-home-cell=/g) || []).length, 36);
    assert.equal((svg.match(/data-base-slot=/g) || []).length, 24);
    assert.doesNotMatch(svg, /data-avatar=|<image id="avatar-/);
    assert.match(svg, /<text[^>]*>OPTIMIST<\/text>/);
    assert.match(svg, /<text[^>]*>LUDO<\/text>/);
  }
});
