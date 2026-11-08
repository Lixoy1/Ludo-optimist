import {
  createClassicState, legalMoves as classicLegalMoves, rollClassicDice,
  applyClassicMove, assertClassicState,
} from './classic-engine.js';
import { getPlayableGeometry } from '../../src/game-geometries.js';
import {
  BASE_STEP_PROGRESS,
  calculateDestinationProgress,
  isOuterTrackProgress,
  positionFromStepProgress,
  progressConfigForState,
} from '../../src/game-progress.js';

export const TOKENS_PER_PLAYER = 4;

function normalizeBoardType(boardType) {
  const value = String(boardType || 'CLASSIC').toUpperCase();
  if (!['CLASSIC', 'HEXA'].includes(value)) {
    throw new RangeError('Board type must be CLASSIC or HEXA.');
  }
  return value;
}

function extendedGeometry(state) {
  return getPlayableGeometry(state.mode);
}

export function createExtendedState(boardType, roster) {
  const mode = normalizeBoardType(boardType);
  if (mode === 'CLASSIC') throw new RangeError('Use createClassicState for Classic.');
  const geometry = getPlayableGeometry(mode);
  if (!Array.isArray(roster) || roster.length !== geometry.maxPlayers) {
    throw new RangeError(`${mode} requires exactly ${geometry.maxPlayers} players.`);
  }
  const ids = roster.map((player) => player?.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new TypeError('Player IDs must be non-empty and unique.');
  }

  const players = roster.map((player, index) => {
    const arm = geometry.arms[index];
    if (player.color && player.color !== arm.player.id) {
      throw new TypeError(`${mode} seat ${index + 1} must use ${arm.player.id}.`);
    }
    return {
      id:player.id,
      color:arm.player.id,
      armIndex:arm.index,
      startIndex:arm.startIndex,
      username:String(player.username ?? player.id).slice(0,40),
      characterId:String(player.characterId || 'optimist'),
      status:'playing',
      finishedAt:null,
    };
  });

  const tokens = {};
  for (const player of players) {
    for (let index = 0; index < TOKENS_PER_PLAYER; index += 1) {
      const id = `${player.id}:${index}`;
      tokens[id] = {
        id,
        owner:player.id,
        color:player.color,
        index,
        stepProgress:BASE_STEP_PROGRESS,
      };
    }
  }
  return {
    mode,
    phase:'playing',
    players,
    tokens,
    currentPlayer:players[0].id,
    dice:null,
    consecutiveSixes:0,
    winner:null,
    revision:0,
    trackLength:geometry.trackLength,
    homeCellCount:geometry.homeCells,
    maxOuterSteps:geometry.maxOuterSteps,
    finishStep:geometry.finishStep,
    safeTrackIndices:[...geometry.safeIndices],
    lastAction:null,
  };
}

export function extendedGlobalTrackIndex(state, player, stepProgress) {
  const geometry = extendedGeometry(state);
  if (!player || !isOuterTrackProgress(stepProgress, progressConfigForState(state))) {
    throw new RangeError('Invalid extended outer-track position.');
  }
  return (player.startIndex + stepProgress) % geometry.trackLength;
}

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId) ?? null;
}

function tokenDestinationProgress(state, token, dice) {
  return calculateDestinationProgress(token.stepProgress, dice, progressConfigForState(state));
}

function trackTokensAt(state, globalIndex, exceptTokenId = null) {
  const config = progressConfigForState(state);
  return Object.values(state.tokens).filter((token) => {
    if (token.id === exceptTokenId || !isOuterTrackProgress(token.stepProgress, config)) return false;
    const owner = playerById(state, token.owner);
    return owner && extendedGlobalTrackIndex(state, owner, token.stepProgress) === globalIndex;
  });
}

function isBlockedAt(state, globalIndex, exceptTokenId = null) {
  const owners = new Map();
  for (const token of trackTokensAt(state, globalIndex, exceptTokenId)) {
    owners.set(token.owner, (owners.get(token.owner) || 0) + 1);
  }
  return [...owners.values()].some((count) => count >= 2);
}

function pathIsClear(state, token, destinationProgress) {
  const config = progressConfigForState(state);
  if (!isOuterTrackProgress(token.stepProgress, config)) return true;
  const owner = playerById(state, token.owner);
  const lastOuterProgress = Math.min(destinationProgress, config.maxOuterSteps);
  for (let progress = token.stepProgress + 1; progress <= lastOuterProgress; progress += 1) {
    if (isBlockedAt(state, extendedGlobalTrackIndex(state, owner, progress), token.id)) return false;
  }
  return true;
}

function canLand(state, token, destinationProgress) {
  const config = progressConfigForState(state);
  const destination = positionFromStepProgress(destinationProgress, config);
  if (destination.zone !== 'track') return true;
  const owner = playerById(state, token.owner);
  const globalIndex = extendedGlobalTrackIndex(state, owner, destinationProgress);
  return !isBlockedAt(state, globalIndex, token.id);
}

export function universalLegalMoves(state, playerId, dice = state?.dice) {
  if (state?.mode === 'CLASSIC') return classicLegalMoves(state, playerId, dice);
  if (!state || state.mode !== 'HEXA') return [];
  if (state.phase !== 'playing' || state.currentPlayer !== playerId ||
      !playerById(state, playerId) || !Number.isInteger(dice) || dice < 1 || dice > 6) return [];
  return Object.values(state.tokens)
    .filter((token) => token.owner === playerId)
    .filter((token) => {
      const destination = tokenDestinationProgress(state, token, dice);
      return destination !== null && pathIsClear(state, token, destination) && canLand(state, token, destination);
    })
    .map((token) => token.id);
}

function nextActivePlayer(state, currentPlayerId) {
  const index = state.players.findIndex((player) => player.id === currentPlayerId);
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = state.players[(index + offset) % state.players.length];
    if (candidate.status !== 'finished') return candidate.id;
  }
  return currentPlayerId;
}

function copyState(state) {
  return structuredClone(state);
}

export function rollUniversalDice(state, playerId, dice) {
  if (state?.mode === 'CLASSIC') return rollClassicDice(state, playerId, dice);
  if (!state || state.mode !== 'HEXA') throw new TypeError('Unknown Ludo game mode.');
  if (state.phase !== 'playing' || state.currentPlayer !== playerId || state.dice !== null) {
    throw new Error('Dice cannot be rolled now.');
  }
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) {
    throw new RangeError('Dice must be an integer from 1 to 6.');
  }

  const next = copyState(state);
  next.consecutiveSixes = dice === 6 ? next.consecutiveSixes + 1 : 0;
  next.lastAction = { type:'ROLL', playerId, dice };
  next.revision += 1;

  if (next.consecutiveSixes === 3) {
    next.consecutiveSixes = 0;
    next.currentPlayer = nextActivePlayer(next, playerId);
    next.lastAction.skipped = true;
    return { state:next, legalTokenIds:[], skipped:true, bonusRoll:false, turnAdvanced:true };
  }

  next.dice = dice;
  const moves = universalLegalMoves(next, playerId, dice);
  if (moves.length === 0) {
    next.dice = null;
    const bonusRoll = dice === 6;
    if (!bonusRoll) next.currentPlayer = nextActivePlayer(next, playerId);
    return { state:next, legalTokenIds:[], skipped:false, bonusRoll, turnAdvanced:!bonusRoll };
  }
  return { state:next, legalTokenIds:moves, skipped:false, bonusRoll:false, turnAdvanced:false };
}

export function applyUniversalMove(state, playerId, tokenId) {
  if (state?.mode === 'CLASSIC') return applyClassicMove(state, playerId, tokenId);
  if (!state || state.mode !== 'HEXA') throw new TypeError('Unknown Ludo game mode.');
  if (state.phase !== 'playing' || state.currentPlayer !== playerId || state.dice === null) {
    throw new Error('There is no pending move for this player.');
  }
  if (!universalLegalMoves(state, playerId, state.dice).includes(tokenId)) {
    throw new Error('Illegal move.');
  }

  const next = copyState(state);
  const token = next.tokens[tokenId];
  const dice = next.dice;
  const config = progressConfigForState(next);
  const fromProgress = token.stepProgress;
  const from = positionFromStepProgress(fromProgress, config);
  const destinationProgress = tokenDestinationProgress(next, token, dice);
  const to = positionFromStepProgress(destinationProgress, config);
  token.stepProgress = destinationProgress;
  const captured = [];

  if (to.zone === 'track') {
    const owner = playerById(next, playerId);
    const globalIndex = extendedGlobalTrackIndex(next, owner, destinationProgress);
    const safe = new Set(next.safeTrackIndices);
    if (!safe.has(globalIndex)) {
      for (const enemy of Object.values(next.tokens)) {
        if (enemy.owner === playerId || !isOuterTrackProgress(enemy.stepProgress, config)) continue;
        const enemyOwner = playerById(next, enemy.owner);
        if (extendedGlobalTrackIndex(next, enemyOwner, enemy.stepProgress) === globalIndex) {
          enemy.stepProgress = BASE_STEP_PROGRESS;
          captured.push(enemy.id);
        }
      }
    }
  }

  const finishedCount = Object.values(next.tokens).filter((item) =>
    item.owner === playerId && item.stepProgress === config.finishStep
  ).length;
  const justFinished = to.zone === 'finished';
  if (finishedCount === TOKENS_PER_PLAYER) {
    const player = playerById(next, playerId);
    player.status = 'finished';
    player.finishedAt = next.revision + 1;
    next.phase = 'finished';
    next.winner = playerId;
  }

  const bonusRoll = next.phase !== 'finished' && (dice === 6 || captured.length > 0 || justFinished);
  next.dice = null;
  if (next.phase !== 'finished' && !bonusRoll) next.currentPlayer = nextActivePlayer(next, playerId);
  next.lastAction = {
    type:'MOVE', playerId, tokenId, dice, from, to,
    fromProgress,
    toProgress:destinationProgress,
    captured, bonusRoll,
  };
  next.revision += 1;
  return { state:next, captured, bonusRoll, turnAdvanced:!bonusRoll && next.phase !== 'finished' };
}

export function assertUniversalState(state) {
  if (state?.mode === 'CLASSIC') return assertClassicState(state);
  if (!state || state.mode !== 'HEXA' || !Array.isArray(state.players) || !state.tokens) {
    throw new TypeError('Malformed extended Ludo state.');
  }
  const geometry = extendedGeometry(state);
  const config = progressConfigForState(state);
  if (state.players.length !== geometry.maxPlayers) {
    throw new RangeError(`${state.mode} requires exactly ${geometry.maxPlayers} players.`);
  }
  if (state.trackLength !== geometry.trackLength || state.homeCellCount !== geometry.homeCells ||
      state.maxOuterSteps !== geometry.maxOuterSteps || state.finishStep !== geometry.finishStep) {
    throw new Error('Extended board route metadata does not match its geometry.');
  }
  if (!state.players.some((player) => player.id === state.currentPlayer)) {
    throw new Error('Current player is missing.');
  }
  const colors = new Set();
  for (const [armIndex, player] of state.players.entries()) {
    const arm = geometry.arms[armIndex];
    if (player.color !== arm.player.id || player.armIndex !== armIndex || player.startIndex !== arm.startIndex ||
        colors.has(player.color)) throw new Error('Extended player seats are not aligned with board arms.');
    colors.add(player.color);
    const owned = Object.values(state.tokens).filter((token) => token.owner === player.id);
    if (owned.length !== TOKENS_PER_PLAYER) throw new Error(`Player ${player.id} must own exactly four tokens.`);
    for (const token of owned) {
      if (token.color !== player.color) throw new Error('Token color must match its owner.');
      positionFromStepProgress(token.stepProgress, config);
    }
  }
  return true;
}

export function createUniversalState(boardType, roster) {
  const mode = normalizeBoardType(boardType);
  return mode === 'CLASSIC' ? createClassicState(roster) : createExtendedState(mode, roster);
}
