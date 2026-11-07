/**
 * Optimist Ludo 2.0.0 — frozen board metadata contract.
 *
 * This module intentionally does not generate coordinates. Coordinates must be
 * produced by the geometry generator from the full board-specific route tables,
 * then validated against this contract before they are exported.
 */
export const GEOMETRY_VERSION = '2.0.0';
export const CELL_SIZE = 128;

export const BOARD_CONTRACTS = Object.freeze({
  CLASSIC: Object.freeze({
    id: 'CLASSIC',
    players: 4,
    outerTrackLength: 52,
    cellsPerSector: 13,
    sectorCount: 4,
    homePathLength: 5,
    maxOuterSteps: 50,
    totalStepsToFinish: 56,
    grid: Object.freeze({ columns: 15, rows: 15 }),
    canvas: Object.freeze({ width: 2304, height: 2304 }),
    geometry: 'orthogonal',
  }),
  HEXA: Object.freeze({
    id: 'HEXA',
    players: 6,
    outerTrackLength: 72,
    cellsPerSector: 12,
    sectorCount: 6,
    homePathLength: 6,
    maxOuterSteps: 71,
    totalStepsToFinish: 78,
    grid: Object.freeze({ columns: 0, rows: 0 }),
    canvas: Object.freeze({ width: 2560, height: 2560 }),
    geometry: 'radial-hex',
    sectorAngleDeg: 60,
  }),
  ROYAL: Object.freeze({
    id: 'ROYAL',
    players: 4,
    outerTrackLength: 68,
    cellsPerSector: 17,
    sectorCount: 4,
    homePathLength: 7,
    maxOuterSteps: 66,
    totalStepsToFinish: 74,
    grid: Object.freeze({ columns: 19, rows: 19 }),
    canvas: Object.freeze({ width: 2816, height: 2816 }),
    geometry: 'radial-four-sector',
  }),
});

export const CELL_METRICS = Object.freeze({
  cellSize: CELL_SIZE,
  gapRatio: 0.04,
  faceRatio: 0.96,
  paddingRatio: 0.08,
  safeAreaRatio: 0.80,
  pawnBaseRatio: 0.68,
});

export function getBoardContract(boardId) {
  const id = String(boardId ?? '').toUpperCase();
  const contract = BOARD_CONTRACTS[id];
  if (!contract) throw new RangeError('Unknown Optimist Ludo 2.0 board: ' + id);
  return contract;
}

export function assertBoardContract(contract) {
  if (!contract || !contract.id) throw new TypeError('Board contract is required.');
  const expected = BOARD_CONTRACTS[contract.id];
  if (!expected) throw new RangeError('Unknown Optimist Ludo 2.0 board: ' + contract.id);
  for (const key of [
    'players', 'outerTrackLength', 'cellsPerSector', 'sectorCount',
    'homePathLength', 'maxOuterSteps', 'totalStepsToFinish',
  ]) {
    if (contract[key] !== expected[key]) {
      throw new Error(contract.id + ' contract mismatch for ' + key + '.');
    }
  }
  if (contract.outerTrackLength !== contract.cellsPerSector * contract.sectorCount) {
    throw new Error(contract.id + ' outer route must equal cellsPerSector × sectorCount.');
  }
  // The step ceiling is deliberately stored independently from route length.
  // Classic and Royal do not use outerTrackLength - 1 as maxOuterSteps.
  if (contract.totalStepsToFinish !== contract.maxOuterSteps + contract.homePathLength + 1) {
    throw new Error(contract.id + ' finish-step arithmetic is inconsistent.');
  }
  if (contract.canvas.width !== contract.canvas.height) {
    throw new Error(contract.id + ' canvas must remain square.');
  }
  return true;
}

export function assertAllBoardContracts() {
  for (const contract of Object.values(BOARD_CONTRACTS)) assertBoardContract(contract);
  return true;
}
