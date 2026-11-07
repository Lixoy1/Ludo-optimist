import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEOMETRY_VERSION, CELL_SIZE, CELL_METRICS, BOARD_CONTRACTS,
  getBoardContract, assertBoardContract, assertAllBoardContracts,
} from '../src/geometry-v2-contract.js';

test('Optimist Ludo 2.0 contract exposes exactly Classic, Hexa and Royal', () => {
  assert.equal(GEOMETRY_VERSION, '2.0.0');
  assert.deepEqual(Object.keys(BOARD_CONTRACTS), ['CLASSIC', 'HEXA', 'ROYAL']);
  assert.equal(assertAllBoardContracts(), true);
});

test('board route, sector, home and finish counts match the approved specification', () => {
  const expected = {
    CLASSIC: [4, 52, 13, 4, 5, 50, 56],
    HEXA: [6, 72, 12, 6, 6, 71, 78],
    ROYAL: [4, 68, 17, 4, 7, 66, 74],
  };
  for (const [id, values] of Object.entries(expected)) {
    const c = getBoardContract(id);
    assert.deepEqual([
      c.players, c.outerTrackLength, c.cellsPerSector, c.sectorCount,
      c.homePathLength, c.maxOuterSteps, c.totalStepsToFinish,
    ], values);
    assert.equal(assertBoardContract(c), true);
  }
});

test('fixed logical cell metrics are shared by every board', () => {
  assert.equal(CELL_SIZE, 128);
  assert.deepEqual(CELL_METRICS, {
    cellSize: 128,
    gapRatio: 0.04,
    faceRatio: 0.96,
    paddingRatio: 0.08,
    safeAreaRatio: 0.8,
    pawnBaseRatio: 0.68,
  });
});

test('Classic, Hexa and Royal preserve their distinct canvas and grid contracts', () => {
  assert.deepEqual(getBoardContract('CLASSIC').grid, { columns: 15, rows: 15 });
  assert.deepEqual(getBoardContract('CLASSIC').canvas, { width: 2304, height: 2304 });
  assert.deepEqual(getBoardContract('HEXA').canvas, { width: 2560, height: 2560 });
  assert.equal(getBoardContract('HEXA').sectorAngleDeg, 60);
  assert.deepEqual(getBoardContract('ROYAL').grid, { columns: 19, rows: 19 });
  assert.deepEqual(getBoardContract('ROYAL').canvas, { width: 2816, height: 2816 });
});

test('step ceiling is not inferred from outer route length', () => {
  assert.equal(getBoardContract('CLASSIC').maxOuterSteps, 50);
  assert.equal(getBoardContract('CLASSIC').outerTrackLength - 1, 51);
  assert.equal(getBoardContract('ROYAL').maxOuterSteps, 66);
  assert.equal(getBoardContract('ROYAL').outerTrackLength - 1, 67);
});

test('unknown board IDs and corrupted movement metadata are rejected', () => {
  assert.throws(() => getBoardContract('PENTA'), RangeError);
  assert.throws(() => getBoardContract('HEX'), RangeError);
  assert.throws(() => getBoardContract('DIAMOND'), RangeError);
  assert.throws(() => assertBoardContract({
    ...getBoardContract('HEXA'), totalStepsToFinish: 77,
  }), /finish-step arithmetic/);
});
