import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClassicState, legalMoves, rollClassicDice, applyClassicMove,
  globalTrackIndex, assertClassicState, LAST_HOME_STEP, FINISH_STEP,
} from '../apps/backend/classic-engine.js';

const roster = [
  { id: 'u-red', color: 'red', username: 'Red' },
  { id: 'u-green', color: 'green', username: 'Green' },
];
const token = (id, index = 0) => `${id}:${index}`;
function onTrack(state, playerId, color, index, step) {
  state.tokens[token(playerId, index)].position = { zone: 'track', step };
}

test('a token leaves base only on six', () => {
  const state = createClassicState(roster);
  assert.deepEqual(legalMoves(state, 'u-red', 5), []);
  assert.equal(legalMoves(state, 'u-red', 6).length, 4);
});

test('home lane has five cells and finish requires the exact final step', () => {
  const state = createClassicState(roster);
  state.tokens[token('u-red')].position = { zone: 'home', step: 54 };
  assert.deepEqual(legalMoves(state, 'u-red', 1), [token('u-red')]);
  let rolled = rollClassicDice(state, 'u-red', 1);
  let moved = applyClassicMove(rolled.state, 'u-red', token('u-red'));
  assert.deepEqual(moved.state.tokens[token('u-red')].position, { zone: 'home', step: LAST_HOME_STEP });
  assert.equal(moved.state.currentPlayer, 'u-green');

  const finishState = createClassicState(roster);
  finishState.tokens[token('u-red')].position = { zone: 'home', step: 55 };
  assert.deepEqual(legalMoves(finishState, 'u-red', 1), [token('u-red')]);
  assert.deepEqual(legalMoves(finishState, 'u-red', 2), []);
  const finalRoll = rollClassicDice(finishState, 'u-red', 1);
  const finalMove = applyClassicMove(finalRoll.state, 'u-red', token('u-red'));
  assert.deepEqual(finalMove.state.tokens[token('u-red')].position, { zone: 'finished', step: FINISH_STEP });
});

test('a normal move advances the turn; rolling six preserves it', () => {
  const state = createClassicState(roster);
  onTrack(state, 'u-red', 'red', 0, 0);
  const ordinary = rollClassicDice(state, 'u-red', 2);
  const afterOrdinary = applyClassicMove(ordinary.state, 'u-red', token('u-red'));
  assert.equal(afterOrdinary.state.currentPlayer, 'u-green');

  const bonusState = createClassicState(roster);
  const six = rollClassicDice(bonusState, 'u-red', 6);
  const afterSix = applyClassicMove(six.state, 'u-red', token('u-red'));
  assert.equal(afterSix.bonusRoll, true);
  assert.equal(afterSix.state.currentPlayer, 'u-red');
  assert.equal(afterSix.state.dice, null);
});

test('third consecutive six skips the turn', () => {
  let state = createClassicState(roster);
  let first = rollClassicDice(state, 'u-red', 6);
  state = applyClassicMove(first.state, 'u-red', token('u-red')).state;
  let second = rollClassicDice(state, 'u-red', 6);
  state = applyClassicMove(second.state, 'u-red', token('u-red')).state;
  const third = rollClassicDice(state, 'u-red', 6);
  assert.equal(third.skipped, true);
  assert.equal(third.state.currentPlayer, 'u-green');
  assert.equal(third.state.consecutiveSixes, 0);
});

test('single enemy is captured on unsafe cell and capture grants a bonus roll', () => {
  const state = createClassicState(roster);
  onTrack(state, 'u-red', 'red', 0, 3);
  onTrack(state, 'u-green', 'green', 0, 30); // both resolve to global track index 30
  assert.equal(globalTrackIndex('red', 4), globalTrackIndex('green', 30));
  const rolled = rollClassicDice(state, 'u-red', 1);
  const moved = applyClassicMove(rolled.state, 'u-red', token('u-red'));
  assert.deepEqual(moved.captured, [token('u-green')]);
  assert.deepEqual(moved.state.tokens[token('u-green')].position, { zone: 'base', step: -1 });
  assert.equal(moved.bonusRoll, true);
  assert.equal(moved.state.currentPlayer, 'u-red');
});

test('safe cells protect a single enemy token', () => {
  const state = createClassicState(roster);
  onTrack(state, 'u-red', 'red', 0, 7);
  onTrack(state, 'u-green', 'green', 0, 34); // both resolve to safe global index 34
  const rolled = rollClassicDice(state, 'u-red', 1);
  const moved = applyClassicMove(rolled.state, 'u-red', token('u-red'));
  assert.deepEqual(moved.captured, []);
  assert.deepEqual(moved.state.tokens[token('u-green')].position, { zone: 'track', step: 34 });
});

test('two same-owner tokens form a blockade that cannot be landed on or crossed', () => {
  const state = createClassicState(roster);
  onTrack(state, 'u-green', 'green', 0, 20); // global cell 20
  onTrack(state, 'u-green', 'green', 1, 20);
  onTrack(state, 'u-red', 'red', 0, 45); // one step before global cell 20
  assert.deepEqual(legalMoves(state, 'u-red', 1), []);

  const crossing = createClassicState(roster);
  onTrack(crossing, 'u-green', 'green', 0, 5); // global cell 5
  onTrack(crossing, 'u-green', 'green', 1, 5);
  onTrack(crossing, 'u-red', 'red', 0, 29); // crosses global cell 5 on a five
  assert.deepEqual(legalMoves(crossing, 'u-red', 5), []);
});

test('a six with no legal moves gives another roll; a non-six passes the turn', () => {
  const state = createClassicState(roster);
  const six = rollClassicDice(state, 'u-red', 6);
  assert.equal(six.bonusRoll, false); // There are legal exits from base.
  const noMove = createClassicState(roster);
  for (let i = 0; i < 4; i += 1) noMove.tokens[token('u-red', i)].position = { zone: 'finished', step: FINISH_STEP };
  const noMoveSix = rollClassicDice(noMove, 'u-red', 6);
  assert.equal(noMoveSix.bonusRoll, true);
  assert.equal(noMoveSix.state.currentPlayer, 'u-red');
  const noMoveTwo = rollClassicDice(noMove, 'u-red', 2);
  assert.equal(noMoveTwo.turnAdvanced, true);
  assert.equal(noMoveTwo.state.currentPlayer, 'u-green');
});

test('state invariant checks all four tokens and the current player', () => {
  const state = createClassicState(roster);
  assert.equal(assertClassicState(state), true);
  delete state.tokens[token('u-red', 3)];
  assert.throws(() => assertClassicState(state), /four tokens/);
});

test('the fourth finished token ends the match and records the winner', () => {
  const state = createClassicState(roster);
  const playerId = roster[0].id;
  const owned = Object.values(state.tokens).filter((token) => token.owner === playerId);
  for (const token of owned.slice(0, 3)) token.position = { zone: 'finished', step: FINISH_STEP };
  owned[3].position = { zone: 'home', step: LAST_HOME_STEP };
  state.currentPlayer = playerId;
  state.dice = 1;
  const result = applyClassicMove(state, playerId, owned[3].id);
  assert.equal(result.state.phase, 'finished');
  assert.equal(result.state.winner, playerId);
  assert.equal(result.state.players[0].status, 'finished');
  assert.equal(result.state.tokens[owned[3].id].position.zone, 'finished');
});