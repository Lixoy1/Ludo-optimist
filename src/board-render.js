import { MAIN_TRACK, PLAYER_CONFIG } from './geometry.js';
import { getStackLayout } from './stack-layout.js';

export const BOARD_IMAGE_SIZE = 1536;
const DESIGN_SIZE = 1248;
const IMAGE_SCALE = BOARD_IMAGE_SIZE / DESIGN_SIZE;
const GRID_ORIGIN_X = 64;
const GRID_ORIGIN_Y = 60;
const GRID_CELL = 80;
const BASE_SLOT_POINTS = {
  blue: [[285, 312], [435, 312], [285, 465], [435, 465]],
  red: [[1107, 312], [1258, 312], [1107, 465], [1258, 465]],
  green: [[285, 1045], [435, 1045], [285, 1205], [435, 1205]],
  yellow: [[1107, 1045], [1258, 1045], [1107, 1205], [1258, 1205]],
};
const FINISH_POINTS = [
  [733, 733], [803, 733], [733, 803], [803, 803],
];

export function gridToImage(col, row) {
  if (!Number.isFinite(col) || !Number.isFinite(row)) throw new TypeError('Grid coordinates must be finite numbers.');
  return {
    x: (GRID_ORIGIN_X + col * GRID_CELL) * IMAGE_SCALE,
    y: (GRID_ORIGIN_Y + row * GRID_CELL) * IMAGE_SCALE,
  };
}

export function tokenBoardPositions(state) {
  if (!state?.tokens || !state?.players) return [];
  const tokens = Object.values(state.tokens);
  const grouped = new Map();
  const basePositions = new Map();
  const playerCharacters = new Map((state.players || []).map((player) => [player.id, player.characterId || 'optimist']));

  for (const token of tokens) {
    const { zone, step } = token.position;
    if (zone === 'base') {
      const [x, y] = BASE_SLOT_POINTS[token.color]?.[token.index] ?? BASE_SLOT_POINTS.blue[0];
      basePositions.set(token.id, { x, y, scale: 1, slot: token.index });
      continue;
    }
    if (zone === 'finished') {
      const [x, y] = FINISH_POINTS[token.index] ?? FINISH_POINTS[0];
      basePositions.set(token.id, { x, y, scale: 0.8, slot: token.index });
      continue;
    }

    let key;
    let point;
    if (zone === 'track') {
      const config = PLAYER_CONFIG[token.color];
      const trackIndex = (config.start + step) % MAIN_TRACK.length;
      const cell = MAIN_TRACK[trackIndex];
      key = `track:${trackIndex}`;
      point = gridToImage(cell.col, cell.row);
    } else if (zone === 'home') {
      const laneIndex = step - 52;
      const cell = PLAYER_CONFIG[token.color]?.lane[laneIndex];
      if (!cell) throw new RangeError(`Invalid home lane step ${step} for ${token.color}.`);
      key = `home:${token.color}:${laneIndex}`;
      point = gridToImage(cell[0], cell[1]);
    } else {
      throw new Error(`Unknown token zone: ${zone}`);
    }
    const bucket = grouped.get(key) ?? { point, tokens: [] };
    bucket.tokens.push(token);
    grouped.set(key, bucket);
  }

  const positions = new Map(basePositions);
  for (const { point, tokens: stack } of grouped.values()) {
    const layout = getStackLayout(stack.length, 80 * IMAGE_SCALE);
    stack.forEach((token, index) => {
      const offset = layout.positions[index];
      positions.set(token.id, {
        x: point.x + offset.x,
        y: point.y + offset.y,
        scale: layout.scale,
        slot: index,
      });
    });
  }

  return tokens.map((token) => {
    const point = positions.get(token.id);
    return {
      tokenId: token.id,
      owner: token.owner,
      characterId: playerCharacters.get(token.owner) || 'optimist',
      color: token.color,
      index: token.index,
      zone: token.position.zone,
      x: point.x,
      y: point.y,
      left: point.x / BOARD_IMAGE_SIZE * 100,
      top: point.y / BOARD_IMAGE_SIZE * 100,
      scale: point.scale,
      slot: point.slot,
    };
  });
}
