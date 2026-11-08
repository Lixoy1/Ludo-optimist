import test from 'node:test';
import assert from 'node:assert/strict';
import { getStackLayout } from '../src/stack-layout.js';

const CELL = 43.57;
const PAWN_DIAMETER = CELL * 0.875;

function assertStackFits(layout, cellSize, pawnDiameter) {
  const visible = layout.positions.filter((position) => position.visible);
  const diameter = pawnDiameter * layout.scale;
  for (const position of visible) {
    assert.ok(Math.abs(position.x) + diameter / 2 < cellSize / 2);
    assert.ok(Math.abs(position.y) + diameter / 2 < cellSize / 2);
  }
  for (let first = 0; first < visible.length; first += 1) {
    for (let second = first + 1; second < visible.length; second += 1) {
      assert.ok(
        Math.hypot(
          visible[first].x - visible[second].x,
          visible[first].y - visible[second].y,
        ) > diameter,
        'visible pawn artwork must not overlap',
      );
    }
  }
}

test('one pawn remains centred at full size', () => {
  const layout = getStackLayout(1, CELL);
  assert.deepEqual(layout.positions, [{ x: 0, y: 0, scale: 1, visible: true }]);
  assert.equal(layout.hiddenCount, 0);
  assertStackFits(layout, CELL, PAWN_DIAMETER);
});

test('two pawns occupy opposite diagonal slots without overlap', () => {
  const layout = getStackLayout(2, CELL);
  assert.equal(layout.positions.length, 2);
  assert.equal(layout.scale, 0.48);
  assert.equal(layout.hiddenCount, 0);
  assertStackFits(layout, CELL, PAWN_DIAMETER);
});

test('three and four pawns form a compact 2x2 group inside one logical tile', () => {
  for (const count of [3, 4]) {
    const layout = getStackLayout(count, CELL);
    assert.equal(layout.positions.length, count);
    assert.equal(layout.hiddenCount, 0);
    assert.equal(layout.scale, 0.42);
    assertStackFits(layout, CELL, PAWN_DIAMETER);
  }
});

test('overflow remains explicitly represented while four pawns stay visible', () => {
  const layout = getStackLayout(6, CELL);
  assert.equal(layout.positions.length, 6);
  assert.equal(layout.positions.filter((position) => position.visible).length, 4);
  assert.equal(layout.hiddenCount, 2);
  assert.equal(layout.badge, '×6');
  assert.equal(layout.positions[4].scale, 0);
  assert.equal(layout.positions[5].visible, false);
});
