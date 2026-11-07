import test from 'node:test';
import assert from 'node:assert/strict';
import { getStackLayout } from '../src/stack-layout.js';

test('2, 3 and 4 pawn stacks remain distinct and fit inside one logical tile', () => {
  const cell = 43.57;
  // The desktop CSS pawn is 6.2% of the 720px board: 44.64 SVG units.
  const pawnDiameter = 720 * 0.062;
  const scales = { 2: 0.48, 3: 0.46, 4: 0.44 };

  for (const count of [2, 3, 4]) {
    const layout = getStackLayout(count, cell);
    const positions = layout.positions.filter((position) => position.visible);
    const diameter = pawnDiameter * scales[count];
    assert.equal(positions.length, count);
    assert.equal(layout.hiddenCount, 0);
    assert.equal(layout.scale, scales[count]);

    for (const position of positions) {
      assert.ok(Math.abs(position.x) + diameter / 2 < cell / 2);
      assert.ok(Math.abs(position.y) + diameter / 2 < cell / 2);
    }
    for (let a = 0; a < positions.length; a += 1) {
      for (let b = a + 1; b < positions.length; b += 1) {
        const distance = Math.hypot(positions[a].x - positions[b].x, positions[a].y - positions[b].y);
        assert.ok(distance > diameter, `pawn hit areas overlap in a ${count}-pawn stack`);
      }
    }
  }
});

test('overflow remains explicitly represented', () => {
  const layout = getStackLayout(6, 43.57);
  assert.equal(layout.positions.filter((position) => position.visible).length, 4);
  assert.equal(layout.hiddenCount, 2);
});
