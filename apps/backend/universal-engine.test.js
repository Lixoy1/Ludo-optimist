import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlayableGeometry } from '../../src/game-geometries.js';
import {
  createExtendedState, extendedGlobalTrackIndex, universalLegalMoves,
  rollUniversalDice, applyUniversalMove, assertUniversalState,
} from './universal-engine.js';

function roster(mode) {
  const geometry = getPlayableGeometry(mode);
  return geometry.arms.map((arm, index) => ({
    id: `player-${index}`, username: `Player ${index + 1}`, color: arm.player.id,
  }));
}
function token(playerId, index = 0) { return `${playerId}:${index}`; }
function stateFor(mode) { return createExtendedState(mode, roster(mode)); }
function setTrack(state, playerId, index, step) {
  state.tokens[token(playerId, index)].position = { zone: 'track', step };
}

for (const mode of ['DIAMOND', 'PENTA', 'HEX']) {
  const geometry = getPlayableGeometry(mode);
  test(`${mode} has one four-token seat per arm and geometry-aligned route metadata`, () => {
    const state = stateFor(mode);
    assert.equal(state.players.length, geometry.sides);
    assert.equal(Object.keys(state.tokens).length, geometry.sides * 4);
    assert.equal(state.trackLength, geometry.trackLength);
    assert.equal(state.trackLength, geometry.sides * 13);
    assert.equal(state.homeCellCount, 5);
    assert.equal(state.finishStep, geometry.trackLength + 5);
    assert.equal(state.safeTrackIndices.length, geometry.sides * 2);
    assert.equal(assertUniversalState(state), true);
  });

  test(`${mode} only releases tokens on six and moves around its own start-relative loop`, () => {
    const state = stateFor(mode);
    assert.deepEqual(universalLegalMoves(state, 'player-0', 5), []);
    assert.equal(universalLegalMoves(state, 'player-0', 6).length, 4);
    const rolled = rollUniversalDice(state, 'player-0', 6);
    assert.deepEqual(rolled.legalTokenIds, [token('player-0',0), token('player-0',1), token('player-0',2), token('player-0',3)]);
    const moved = applyUniversalMove(rolled.state, 'player-0', token('player-0',0));
    assert.deepEqual(moved.state.tokens[token('player-0',0)].position, { zone: 'track', step: 0 });
    assert.equal(extendedGlobalTrackIndex(moved.state, moved.state.players[0], 0), geometry.arms[0].startIndex);
    assert.equal(moved.bonusRoll, true);
  });

  test(`${mode} captures an enemy on an unsafe square but leaves all safe squares protected`, () => {
    const state = stateFor(mode);
    const mover = state.players[0], enemy = state.players[1];
    const fromStep = 10, landingStep = 11;
    const target = extendedGlobalTrackIndex(state, mover, landingStep);
    const enemyStep = (target - enemy.startIndex + geometry.trackLength) % geometry.trackLength;
    setTrack(state, mover.id, 0, fromStep);
    setTrack(state, enemy.id, 0, enemyStep);
    assert.ok(!geometry.safeIndices.includes(target));
    const roll = rollUniversalDice(state, mover.id, 1);
    const moved = applyUniversalMove(roll.state, mover.id, token(mover.id));
    assert.deepEqual(moved.captured, [token(enemy.id)]);
    assert.deepEqual(moved.state.tokens[token(enemy.id)].position, { zone: 'base', step: -1 });
    assert.equal(moved.bonusRoll, true);

    const safeState = stateFor(mode);
    const safeMover = safeState.players[0], safeEnemy = safeState.players[1];
    const safeTarget = geometry.arms[0].starIndex;
    const safeFrom = (safeTarget - safeMover.startIndex + geometry.trackLength - 1) % geometry.trackLength;
    const safeEnemyStep = (safeTarget - safeEnemy.startIndex + geometry.trackLength) % geometry.trackLength;
    setTrack(safeState, safeMover.id, 0, safeFrom);
    setTrack(safeState, safeEnemy.id, 0, safeEnemyStep);
    const safeRoll = rollUniversalDice(safeState, safeMover.id, 1);
    const safeMove = applyUniversalMove(safeRoll.state, safeMover.id, token(safeMover.id));
    assert.deepEqual(safeMove.captured, []);
    assert.equal(safeMove.state.tokens[token(safeEnemy.id)].position.zone, 'track');
  });

  test(`${mode} friendly pairs block opponents from landing and crossing`, () => {
    const state = stateFor(mode);
    const mover = state.players[0], blocker = state.players[1];
    const blockedGlobal = extendedGlobalTrackIndex(state, mover, 11);
    const blockerStep = (blockedGlobal - blocker.startIndex + geometry.trackLength) % geometry.trackLength;
    setTrack(state, blocker.id, 0, blockerStep);
    setTrack(state, blocker.id, 1, blockerStep);
    setTrack(state, mover.id, 0, 10);
    assert.deepEqual(universalLegalMoves(state, mover.id, 1), []);
    assert.deepEqual(universalLegalMoves(state, mover.id, 2), []);
  });

  test(`${mode} requires an exact roll to enter the center finish`, () => {
    const state = stateFor(mode);
    const id = token('player-0');
    state.tokens[id].position = { zone: 'home', step: geometry.trackLength + 4 };
    assert.deepEqual(universalLegalMoves(state, 'player-0', 2), []);
    const rolled = rollUniversalDice(state, 'player-0', 1);
    const moved = applyUniversalMove(rolled.state, 'player-0', id);
    assert.deepEqual(moved.state.tokens[id].position, { zone: 'finished', step: geometry.trackLength + 5 });
    assert.equal(moved.state.phase, 'playing');
    assert.equal(moved.bonusRoll, true);
  });

  test(`${mode} three consecutive sixes forfeit the turn`, () => {
    let state = stateFor(mode);
    for (let index = 0; index < 2; index += 1) {
      const rolled = rollUniversalDice(state, 'player-0', 6);
      state = applyUniversalMove(rolled.state, 'player-0', token('player-0', index)).state;
      assert.equal(state.currentPlayer, 'player-0');
    }
    const third = rollUniversalDice(state, 'player-0', 6);
    assert.equal(third.skipped, true);
    assert.equal(third.state.currentPlayer, 'player-1');
    assert.equal(third.state.consecutiveSixes, 0);
    assert.equal(third.state.dice, null);
  });

  test(`${mode} accepts only the exact number of players and validates token positions`, () => {
    assert.throws(() => createExtendedState(mode, roster(mode).slice(0, -1)), /exactly/);
    const malformed = stateFor(mode);
    malformed.tokens[token('player-0')].position = { zone: 'track', step: geometry.trackLength };
    assert.throws(() => assertUniversalState(malformed), /Invalid extended track step/);
  });
}
