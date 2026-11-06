/**
 * Canonical Classic Ludo geometry on a 15x15 logical grid.
 * Coordinates are [column, row]. Visual themes never change these values.
 */
export const GRID_SIZE = 15;
export const CELL_COUNT = 52;

export const COLORS = ['red', 'green', 'yellow', 'blue'];

// Clockwise outer track. This order is the movement order for RED.
export const MAIN_TRACK = [
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
  [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
].map(([col, row], index) => ({ index, col, row, key: `track-${index}` }));

export const PLAYER_CONFIG = {
  // Colors follow the uploaded OPTIMIST LUDO artwork:
  // blue top-left, red top-right, green bottom-left, yellow bottom-right.
  green: {
    label: 'GREEN', start: 0, homeEntry: 51,
    base: { col: 0, row: 9 },
    lane: [[1,7],[2,7],[3,7],[4,7],[5,7]],
    finishTriangle: 'left',
  },
  blue: {
    label: 'BLUE', start: 13, homeEntry: 12,
    base: { col: 0, row: 0 },
    lane: [[7,1],[7,2],[7,3],[7,4],[7,5]],
    finishTriangle: 'top',
  },
  red: {
    label: 'RED', start: 26, homeEntry: 25,
    base: { col: 9, row: 0 },
    lane: [[13,7],[12,7],[11,7],[10,7],[9,7]],
    finishTriangle: 'right',
  },
  yellow: {
    label: 'YELLOW', start: 39, homeEntry: 38,
    base: { col: 9, row: 9 },
    lane: [[7,13],[7,12],[7,11],[7,10],[7,9]],
    finishTriangle: 'bottom',
  },
};

// Common safe squares include all four start cells and four star cells.
export const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const HOME_SLOTS = [
  { x: -0.78, y: -0.78 }, { x: 0.78, y: -0.78 },
  { x: -0.78, y: 0.78 }, { x: 0.78, y: 0.78 },
];

export const FINISH_SLOTS = [
  { x: -0.42, y: -0.42 }, { x: 0.42, y: -0.42 },
  { x: -0.42, y: 0.42 }, { x: 0.42, y: 0.42 },
];

export const CENTER = { col: 7, row: 7 };

export function getTrackCell(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new RangeError(`Track index must be between 0 and ${CELL_COUNT - 1}`);
  }
  return MAIN_TRACK[index];
}

export function getHomeLane(color) {
  const config = PLAYER_CONFIG[color];
  if (!config) throw new Error(`Unknown player color: ${color}`);
  return config.lane.map(([col, row], index) => ({ col, row, index, key: `${color}-home-${index}` }));
}

export function isSafeTrackIndex(index) {
  return SAFE_TRACK_INDICES.has(((index % CELL_COUNT) + CELL_COUNT) % CELL_COUNT);
}

export function getBaseSlots(color) {
  const config = PLAYER_CONFIG[color];
  if (!config) throw new Error(`Unknown player color: ${color}`);
  const { col, row } = config.base;
  return HOME_SLOTS.map((slot, index) => ({
    id: `${color}-base-${index}`,
    x: (col + 3) + slot.x,
    y: (row + 3) + slot.y,
  }));
}

export function assertBoardGeometry() {
  if (MAIN_TRACK.length !== CELL_COUNT) throw new Error('Main track must contain exactly 52 cells');
  const keys = new Set(MAIN_TRACK.map(({ col, row }) => `${col},${row}`));
  if (keys.size !== CELL_COUNT) throw new Error('Main track cells must be unique');
  for (const { col, row } of MAIN_TRACK) {
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) {
      throw new Error(`Track cell out of bounds: ${col},${row}`);
    }
  }
  for (const color of COLORS) {
    if (PLAYER_CONFIG[color].lane.length !== 5) throw new Error(`${color} lane must have five approach cells`);
  }
  return true;
}
