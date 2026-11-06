import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicState } from '../apps/backend/classic-engine.js';
import { tokenBoardPositions, gridToImage, BOARD_IMAGE_SIZE } from '../src/board-render.js';
import { PLAYER_CONFIG, MAIN_TRACK } from '../src/geometry.js';

const roster = [
  { id: 'render-green', color: 'green', username: 'Green' },
  { id: 'render-blue', color: 'blue', username: 'Blue' },
  { id: 'render-red', color: 'red', username: 'Red' },
  { id: 'render-yellow', color: 'yellow', username: 'Yellow' },
];
const tokenId = (player, index = 0) => `${player}:${index}`;
const PAWN_DIAMETER_RATIO = 0.058;

test('board image grid transform maps the logical board into the 720 square artwork', () => {
  assert.equal(BOARD_IMAGE_SIZE, 720);
  const center = gridToImage(7, 7);
  assert.ok(Math.abs(center.x - 359.99) < 1);
  assert.ok(Math.abs(center.y - 359.99) < 1);
});

test('all four player bases are rendered at their assigned colored quadrants', () => {
  const state = createClassicState(roster);
  const positions = tokenBoardPositions(state);
  const first = Object.fromEntries(positions.map((item) => [item.tokenId, item]));
  for (const player of state.players) {
    const owned = positions.filter((item) => item.owner === player.id);
    assert.equal(owned.length, 4);
    assert.equal(owned.every((item) => item.zone === 'base'), true);
    assert.equal(new Set(owned.map((item) => `${item.left.toFixed(2)}:${item.top.toFixed(2)}`)).size, 4);
  }
  assert.ok(first[tokenId('render-green')].left < 40);
  assert.ok(first[tokenId('render-green')].top > 60);
  assert.ok(first[tokenId('render-blue')].left < 40);
  assert.ok(first[tokenId('render-blue')].top < 40);
  assert.deepEqual(PLAYER_CONFIG.blue.base, { col: 0, row: 0 });
  const expectedCenters = {
    blue: [[132, 132], [182, 132], [132, 182], [182, 182]],
    red: [[538, 132], [588, 132], [538, 182], [588, 182]],
    green: [[132, 538], [182, 538], [132, 588], [182, 588]],
    yellow: [[538, 538], [588, 538], [538, 588], [588, 588]],
  };
  for (const [color, centers] of Object.entries(expectedCenters)) {
    const firstFour = positions.filter((item) => item.color === color).sort((a, b) => a.index - b.index);
    if (firstFour.length) centers.forEach(([x, y], index) => {
      assert.ok(Math.abs(firstFour[index].x - x) < 0.01);
      assert.ok(Math.abs(firstFour[index].y - y) < 0.01);
    });
  }
});

test('outer track and home-lane positions are derived from the server token state', () => {
  const state = createClassicState(roster);
  state.tokens[tokenId('render-green')].position = { zone: 'track', step: 0 };
  state.tokens[tokenId('render-green', 1)].position = { zone: 'home', step: 54 };
  const positions = tokenBoardPositions(state);
  const start = positions.find((item) => item.tokenId === tokenId('render-green'));
  const home = positions.find((item) => item.tokenId === tokenId('render-green', 1));
  assert.equal(start.zone, 'track');
  assert.equal(start.left, (gridToImage(1, 6).x / BOARD_IMAGE_SIZE) * 100);
  assert.equal(home.zone, 'home');
  assert.ok(home.left > start.left);
});

test('tokens sharing a route cell receive distinct, non-overlapping scaled positions', () => {
  const state = createClassicState(roster);
  state.tokens[tokenId('render-green')].position = { zone: 'track', step: 5 };
  state.tokens[tokenId('render-green', 1)].position = { zone: 'track', step: 5 };
  const positions = tokenBoardPositions(state).filter((item) => item.zone === 'track');
  assert.equal(positions.length, 2);
  assert.notEqual(positions[0].left, positions[1].left);
  assert.equal(positions[0].scale, 0.48);
  const distance = Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y);
  assert.ok(distance > BOARD_IMAGE_SIZE * PAWN_DIAMETER_RATIO * positions[0].scale);
});

test('all four pawns on one square shrink into a separated 2x2 stack inside the cell', () => {
  const state = createClassicState(roster);
  for (let index = 0; index < 4; index += 1) {
    state.tokens[tokenId('render-green', index)].position = { zone: 'track', step: 5 };
  }
  const positions = tokenBoardPositions(state)
    .filter((item) => item.zone === 'track')
    .sort((a, b) => a.index - b.index);
  assert.equal(positions.length, 4);
  assert.ok(positions.every((item) => item.scale === 0.44));
  assert.equal(new Set(positions.map((item) => `${item.left.toFixed(4)}:${item.top.toFixed(4)}`)).size, 4);

  const center = gridToImage(MAIN_TRACK[5].col, MAIN_TRACK[5].row);
  const pawnDiameter = BOARD_IMAGE_SIZE * PAWN_DIAMETER_RATIO * 0.44;
  const halfCell = 43.57 / 2;
  for (const item of positions) {
    assert.ok(Math.abs(item.x - center.x) + pawnDiameter / 2 <= halfCell);
    assert.ok(Math.abs(item.y - center.y) + pawnDiameter / 2 <= halfCell);
  }
  for (let a = 0; a < positions.length; a += 1) {
    for (let b = a + 1; b < positions.length; b += 1) {
      const distance = Math.hypot(positions[a].x - positions[b].x, positions[a].y - positions[b].y);
      assert.ok(distance > pawnDiameter, 'pawn hit areas must not overlap');
    }
  }
});

test('selected player character is mapped to all four of their visible pawns', () => {
  const state = createClassicState(roster);
  state.players.find((player) => player.id === 'render-blue').characterId = 'lilya-detective';
  const owned = tokenBoardPositions(state).filter((item) => item.owner === 'render-blue');
  assert.equal(owned.length, 4);
  assert.ok(owned.every((item) => item.characterId === 'lilya-detective'));
});

test('all track and home-lane centers stay inside the 720px artwork', () => {
  for (const color of Object.keys(PLAYER_CONFIG)) {
    for (let step = 0; step < 52; step += 1) {
      const config = PLAYER_CONFIG[color];
      const index = (config.start + step) % 52;
      const cell = MAIN_TRACK[index];
      const point = gridToImage(cell.col, cell.row);
      assert.ok(point.x >= 0 && point.x <= BOARD_IMAGE_SIZE);
      assert.ok(point.y >= 0 && point.y <= BOARD_IMAGE_SIZE);
    }
  }
});
