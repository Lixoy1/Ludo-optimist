import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicState } from '../apps/backend/classic-engine.js';
import { tokenBoardPositions, tokenMovementPath, gridToImage, BOARD_IMAGE_SIZE, BASE_SLOT_POINTS, FINISH_POINTS, GRID_CELL, PAWN_DIAMETER_RATIO } from '../src/board-render.js';
import { PLAYER_CONFIG, MAIN_TRACK } from '../src/geometry.js';
import { createExtendedState } from '../apps/backend/universal-engine.js';
import { getPlayableGeometry, getPlayableStackLayout } from '../src/game-geometries.js';

const roster = [
  { id: 'render-green', color: 'green', username: 'Green' },
  { id: 'render-blue', color: 'blue', username: 'Blue' },
  { id: 'render-red', color: 'red', username: 'Red' },
  { id: 'render-yellow', color: 'yellow', username: 'Yellow' },
];
const tokenId = (player, index = 0) => `${player}:${index}`;

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

  const globalIndex = (PLAYER_CONFIG.green.start + 5) % MAIN_TRACK.length;
  const center = gridToImage(MAIN_TRACK[globalIndex].col, MAIN_TRACK[globalIndex].row);
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


for (const mode of ['HEXA', 'ROYAL']) {
  test(mode + ' board renderer maps base, track, home and finish tokens to its own SVG geometry', () => {
    const geometry = getPlayableGeometry(mode);
    const roster = geometry.arms.map((arm, index) => ({ id: mode + '-render-' + index, username: 'Player ' + index, color: arm.player.id }));
    const state = createExtendedState(mode, roster);
    const first = state.players[0];
    const ids = index => first.id + ':' + index;
    state.tokens[ids(0)].position = { zone: 'track', step: 0 };
    state.tokens[ids(1)].position = { zone: 'home', step: geometry.maxOuterSteps + 1 + 2 };
    state.tokens[ids(2)].position = { zone: 'finished', step: geometry.finishStep };
    const positions = tokenBoardPositions(state);
    const start = positions.find(item => item.tokenId === ids(0));
    const home = positions.find(item => item.tokenId === ids(1));
    const finish = positions.find(item => item.tokenId === ids(2));
    const base = positions.find(item => item.tokenId === ids(3));
    assert.equal(start.zone, 'track');
    assert.ok(Math.abs(start.x - geometry.track[geometry.arms[0].startIndex].x) < .001);
    assert.ok(Math.abs(start.y - geometry.track[geometry.arms[0].startIndex].y) < .001);
    assert.equal(home.zone, 'home');
    assert.ok(Math.abs(home.x - geometry.arms[0].homeLane[2].x) < .001);
    assert.ok(Math.abs(home.y - geometry.arms[0].homeLane[2].y) < .001);
    assert.equal(finish.zone, 'finished');
    assert.ok(Math.abs(finish.x - geometry.arms[0].finishSlots[2].x) < .001);
    assert.equal(base.zone, 'base');
    assert.ok(Math.abs(base.x - geometry.arms[0].baseSlots[3].x) < .001);
    assert.equal(positions.length, geometry.maxPlayers * 4);
  });

  test(mode + ' board renderer stacks four pawns within one extended route cell', () => {
    const geometry = getPlayableGeometry(mode);
    const roster = geometry.arms.map((arm, index) => ({ id: mode + '-stack-' + index, username: 'Player ' + index, color: arm.player.id }));
    const state = createExtendedState(mode, roster);
    const owner = state.players[0];
    for (let index = 0; index < 4; index += 1) {
      state.tokens[owner.id + ':' + index].position = { zone: 'track', step: 5 };
    }
    const positions = tokenBoardPositions(state).filter(item => item.zone === 'track');
    assert.equal(positions.length, 4);
    assert.equal(new Set(positions.map(item => item.left.toFixed(4) + ':' + item.top.toFixed(4))).size, 4);
    const expectedScale = getPlayableStackLayout(mode, 4).tokens[0].scale;
    assert.ok(positions.every(item => item.scale === expectedScale && item.visible));
    assert.ok(positions.every(item => Math.abs(item.diameter - geometry.pawnDiameter) < .001));
    assert.equal(positions[0].overflowCount, 0);
  });
}


test('Classic movement path visits every intervening route cell before entering home', () => {
  const state = createClassicState(roster);
  const player = state.players.find(item => item.id === 'render-green');
  const from = { zone: 'track', step: 10 };
  const to = { zone: 'track', step: 13 };
  const path = tokenMovementPath(state, player.id, from, to, 0);
  assert.equal(path.length, 3);
  for (let index = 0; index < 3; index += 1) {
    const cell = MAIN_TRACK[(PLAYER_CONFIG.green.start + 11 + index) % MAIN_TRACK.length];
    const point = gridToImage(cell.col, cell.row);
    assert.deepEqual(path[index], point);
  }
});

test('Classic movement path follows the five-cell home lane and maps its finish socket', () => {
  const state = createClassicState(roster);
  const player = state.players.find(item => item.id === 'render-green');
  const lanePath = tokenMovementPath(state, player.id, { zone: 'track', step: 50 }, { zone: 'home', step: 53 }, 2);
  assert.equal(lanePath.length, 3);
  assert.deepEqual(lanePath[0], gridToImage(PLAYER_CONFIG.green.lane[0][0], PLAYER_CONFIG.green.lane[0][1]));
  assert.deepEqual(lanePath[2], gridToImage(PLAYER_CONFIG.green.lane[2][0], PLAYER_CONFIG.green.lane[2][1]));
  const finish = tokenMovementPath(state, player.id, { zone: 'home', step: 55 }, { zone: 'finished', step: 56 }, 2);
  assert.equal(finish.length, 1);
  assert.deepEqual(finish[0], { x: FINISH_POINTS[2][0], y: FINISH_POINTS[2][1] });
});

for (const mode of ['HEXA', 'ROYAL']) {
  test(mode + ' movement path follows every extended outer-track step and the player home lane', () => {
    const geometry = getPlayableGeometry(mode);
    const roster = geometry.arms.map((arm, index) => ({ id: mode + '-path-' + index, username: 'Player ' + index, color: arm.player.id }));
    const state = createExtendedState(mode, roster);
    const player = state.players[0];
    const path = tokenMovementPath(state, player.id, { zone: 'track', step: 11 }, { zone: 'track', step: 14 }, 0);
    assert.equal(path.length, 3);
    for (let index = 0; index < 3; index += 1) {
      const point = geometry.track[(player.startIndex + 12 + index) % geometry.trackLength];
      assert.deepEqual(path[index], { x: point.x, y: point.y });
    }
    const home = tokenMovementPath(state, player.id,
      { zone: 'track', step: geometry.maxOuterSteps },
      { zone: 'home', step: geometry.maxOuterSteps + 1 + 2 }, 1);
    assert.equal(home.length, 3);
    assert.deepEqual(home[2], { x: geometry.arms[0].homeLane[2].x, y: geometry.arms[0].homeLane[2].y });
  });
}
