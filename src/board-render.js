import { MAIN_TRACK, PLAYER_CONFIG } from './geometry.js';
import { getStackLayout } from './stack-layout.js';

// The supplied board artwork is a 720x720 image. Token coordinates are
// expressed directly in that image's coordinate space so the CSS percentage
// positions stay aligned with the visible tile centers at every screen size.
export const BOARD_IMAGE_SIZE = 720;
const GRID_ORIGIN_X = 55;
const GRID_ORIGIN_Y = 55;
const GRID_CELL = 43.57;
const BASE_SLOT_POINTS = {
  blue: [[132, 132], [182, 132], [132, 182], [182, 182]],
  red: [[538, 132], [588, 132], [538, 182], [588, 182]],
  green: [[132, 538], [182, 538], [132, 588], [182, 588]],
  yellow: [[538, 538], [588, 538], [538, 588], [588, 588]],
};
const FINISH_POINTS = [
  [336, 336], [384, 336], [336, 384], [384, 384],
];

export function gridToImage(col, row) {
  if (!Number.isFinite(col) || !Number.isFinite(row)) throw new TypeError('Grid coordinates must be finite numbers.');
  return {
    x: GRID_ORIGIN_X + col * GRID_CELL,
    y: GRID_ORIGIN_Y + row * GRID_CELL,
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
    const layout = getStackLayout(stack.length, GRID_CELL);
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
