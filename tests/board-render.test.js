import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicState, globalTrackIndex } from '../apps/backend/classic-engine.js';
import { tokenBoardPositions, gridToImage, BOARD_IMAGE_SIZE } from '../src/board-render.js';
import { PLAYER_CONFIG } from '../src/geometry.js';

const roster = [
  { id: 'render-green', color: 'green', username: 'Green' },
  { id: 'render-blue', color: 'blue', username: 'Blue' },
  { id: 'render-red', color: 'red', username: 'Red' },
  { id: 'render-yellow', color: 'yellow', username: 'Yellow' },
];
const tokenId = (player, index = 0) => `${player}:${index}`;

test('board image grid transform maps the logical board into the 1536 square artwork', () => {
  assert.equal(BOARD_IMAGE_SIZE, 1536);
  const center = gridToImage(7, 7);
  assert.ok(Math.abs(center.x - 768) < 1);
  assert.ok(Math.abs(center.y - 763) < 5);
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
    blue: [[285, 312], [435, 312], [285, 465], [435, 465]],
    red: [[1107, 312], [1258, 312], [1107, 465], [1258, 465]],
    green: [[285, 1045], [435, 1045], [285, 1205], [435, 1205]],
    yellow: [[1107, 1045], [1258, 1045], [1107, 1205], [1258, 1205]],
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

test('tokens sharing a route cell receive different stack offsets', () => {
  const state = createClassicState(roster);
  state.tokens[tokenId('render-green')].position = { zone: 'track', step: 5 };
  state.tokens[tokenId('render-green', 1)].position = { zone: 'track', step: 5 };
  const positions = tokenBoardPositions(state).filter((item) => item.zone === 'track');
  assert.equal(positions.length, 2);
  assert.notEqual(positions[0].left, positions[1].left);
  assert.equal(positions[0].scale, 0.78);
});


test('selected player character is mapped to all four of their visible pawns', () => {
  const state = createClassicState(roster);
  state.players.find((player) => player.id === 'render-blue').characterId = 'lilya-detective';
  const owned = tokenBoardPositions(state).filter((item) => item.owner === 'render-blue');
  assert.equal(owned.length, 4);
  assert.ok(owned.every((item) => item.characterId === 'lilya-detective'));
});