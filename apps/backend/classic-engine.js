import { COLORS, PLAYER_CONFIG, SAFE_TRACK_INDICES, CELL_COUNT } from '../../src/geometry.js';
import {
  BASE_STEP_PROGRESS,
  CLASSIC_PROGRESS_CONFIG,
  calculateDestinationProgress,
  isOuterTrackProgress,
  positionFromStepProgress,
  progressToHomeIndex,
} from '../../src/game-progress.js';

export const TOKENS_PER_PLAYER = 4;
export const LAST_TRACK_STEP = CLASSIC_PROGRESS_CONFIG.maxOuterSteps;
export const LAST_HOME_STEP = LAST_TRACK_STEP + CLASSIC_PROGRESS_CONFIG.homeCells;
export const FINISH_STEP = CLASSIC_PROGRESS_CONFIG.finishStep;
const HOME_START_STEP = LAST_TRACK_STEP + 1;

function assertRoster(roster) {
  if (!Array.isArray(roster) || roster.length < 2 || roster.length > 4) {
    throw new RangeError('Classic Ludo requires 2–4 players.');
  }
  const ids = roster.map((player) => player?.id);
  const colors = roster.map((player) => player?.color);
  if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new TypeError('Player IDs must be non-empty and unique.');
  }
  if (colors.some((color) => !COLORS.includes(color)) || new Set(colors).size !== colors.length) {
    throw new TypeError('Player colors must be unique board colors.');
  }
  return roster.map((player) => ({
    id:player.id,
    color:player.color,
    username:String(player.username ?? player.id).slice(0,40),
    characterId:String(player.characterId || 'optimist'),
    status:'playing',
    finishedAt:null,
  }));
}

export function createClassicState(roster) {
  const players = assertRoster(roster);
  const tokens = {};
  for (const player of players) {
    for (let index = 0; index < TOKENS_PER_PLAYER; index += 1) {
      const id = player.id + ':' + index;
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
    mode:'CLASSIC',
    phase:'playing',
    players,
    tokens,
    currentPlayer:players[0].id,
    dice:null,
    consecutiveSixes:0,
    winner:null,
    revision:0,
    lastAction:null,
  };
}

export function globalTrackIndex(color, stepProgress) {
  const config = PLAYER_CONFIG[color];
  if (!config || !isOuterTrackProgress(stepProgress, CLASSIC_PROGRESS_CONFIG)) {
    throw new RangeError('Invalid outer-track position.');
  }
  return (config.start + stepProgress) % CELL_COUNT;
}

const playerById = (state, playerId) => state.players.find((player) => player.id === playerId) || null;

function destinationProgress(token, dice) {
  return calculateDestinationProgress(token.stepProgress, dice, CLASSIC_PROGRESS_CONFIG);
}

function tokensAt(state, globalIndex, exceptTokenId = null) {
  return Object.values(state.tokens).filter((token) =>
    token.id !== exceptTokenId &&
    isOuterTrackProgress(token.stepProgress, CLASSIC_PROGRESS_CONFIG) &&
    globalTrackIndex(token.color, token.stepProgress) === globalIndex
  );
}

function blocked(state, globalIndex, exceptTokenId = null) {
  const counts = new Map();
  for (const token of tokensAt(state, globalIndex, exceptTokenId)) {
    counts.set(token.owner, (counts.get(token.owner) || 0) + 1);
  }
  return [...counts.values()].some((count) => count >= 2);
}

function pathClear(state, token, destination) {
  if (!isOuterTrackProgress(token.stepProgress, CLASSIC_PROGRESS_CONFIG)) return true;
  const lastOuterProgress = Math.min(destination, LAST_TRACK_STEP);
  for (let progress = token.stepProgress + 1; progress <= lastOuterProgress; progress += 1) {
    if (blocked(state, globalTrackIndex(token.color, progress), token.id)) return false;
  }
  return true;
}

function canLand(state, token, destination) {
  const position = positionFromStepProgress(destination, CLASSIC_PROGRESS_CONFIG);
  return position.zone !== 'track' ||
    !blocked(state, globalTrackIndex(token.color, destination), token.id);
}

export function buildOccupancy(state) {
  const occupancy = { track:{}, home:{}, base:{}, finished:{} };
  for (const token of Object.values(state.tokens)) {
    const position = positionFromStepProgress(token.stepProgress, CLASSIC_PROGRESS_CONFIG);
    const key = position.zone === 'track'
      ? String(globalTrackIndex(token.color, token.stepProgress))
      : position.zone === 'home'
        ? token.color + ':' + progressToHomeIndex(token.stepProgress, CLASSIC_PROGRESS_CONFIG)
        : token.owner;
    (occupancy[position.zone][key] ??= []).push(token.id);
  }
  return occupancy;
}

export function legalMoves(state, playerId, dice = state.dice) {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId ||
      !playerById(state, playerId) || !Number.isInteger(dice) || dice < 1 || dice > 6) return [];
  return Object.values(state.tokens)
    .filter((token) => token.owner === playerId)
    .filter((token) => {
      const destination = destinationProgress(token, dice);
      return destination !== null && pathClear(state, token, destination) && canLand(state, token, destination);
    })
    .map((token) => token.id);
}

function nextPlayer(state, playerId) {
  const index = state.players.findIndex((player) => player.id === playerId);
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const player = state.players[(index + offset) % state.players.length];
    if (player.status !== 'finished') return player.id;
  }
  return playerId;
}

const clone = (state) => structuredClone(state);

export function rollClassicDice(state, playerId, dice) {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId || state.dice !== null) {
    throw new Error('Dice cannot be rolled now.');
  }
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new RangeError('Dice must be 1..6.');
  const next = clone(state);
  next.consecutiveSixes = dice === 6 ? next.consecutiveSixes + 1 : 0;
  next.lastAction = { type:'ROLL', playerId, dice };
  next.revision += 1;

  if (next.consecutiveSixes === 3) {
    next.consecutiveSixes = 0;
    next.currentPlayer = nextPlayer(next, playerId);
    next.lastAction.skipped = true;
    return { state:next, legalTokenIds:[], skipped:true, bonusRoll:false, turnAdvanced:true };
  }

  next.dice = dice;
  const moves = legalMoves(next, playerId, dice);
  if (!moves.length) {
    next.dice = null;
    const bonusRoll = dice === 6;
    if (!bonusRoll) next.currentPlayer = nextPlayer(next, playerId);
    return { state:next, legalTokenIds:[], skipped:false, bonusRoll, turnAdvanced:!bonusRoll };
  }
  return { state:next, legalTokenIds:moves, skipped:false, bonusRoll:false, turnAdvanced:false };
}

export function applyClassicMove(state, playerId, tokenId) {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId || state.dice === null) {
    throw new Error('There is no pending move.');
  }
  if (!legalMoves(state, playerId, state.dice).includes(tokenId)) throw new Error('Illegal move.');

  const next = clone(state);
  const token = next.tokens[tokenId];
  const dice = next.dice;
  const from = positionFromStepProgress(token.stepProgress, CLASSIC_PROGRESS_CONFIG);
  const destination = destinationProgress(token, dice);
  const to = positionFromStepProgress(destination, CLASSIC_PROGRESS_CONFIG);
  token.stepProgress = destination;
  const captured = [];

  if (to.zone === 'track') {
    const globalIndex = globalTrackIndex(token.color, destination);
    if (!SAFE_TRACK_INDICES.has(globalIndex)) {
      for (const enemy of Object.values(next.tokens)) {
        if (enemy.owner === playerId || !isOuterTrackProgress(enemy.stepProgress, CLASSIC_PROGRESS_CONFIG)) continue;
        if (globalTrackIndex(enemy.color, enemy.stepProgress) === globalIndex) {
          enemy.stepProgress = BASE_STEP_PROGRESS;
          captured.push(enemy.id);
        }
      }
    }
  }

  const finishedCount = Object.values(next.tokens).filter((item) =>
    item.owner === playerId && item.stepProgress === FINISH_STEP
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
  if (next.phase !== 'finished' && !bonusRoll) next.currentPlayer = nextPlayer(next, playerId);
  next.lastAction = { type:'MOVE', playerId, tokenId, dice, from, to, captured, bonusRoll };
  next.revision += 1;
  return { state:next, captured, bonusRoll, turnAdvanced:!bonusRoll && next.phase !== 'finished' };
}

export function assertClassicState(state) {
  if (!state || state.mode !== 'CLASSIC' || !Array.isArray(state.players) || !state.tokens) {
    throw new TypeError('Malformed Classic Ludo state.');
  }
  if (state.players.length < 2 || state.players.length > 4) {
    throw new RangeError('Classic requires 2–4 players.');
  }
  if (new Set(state.players.map((player) => player.id)).size !== state.players.length ||
      new Set(state.players.map((player) => player.color)).size !== state.players.length ||
      state.players.some((player) => !COLORS.includes(player.color))) {
    throw new Error('Classic player IDs and colors must be unique and valid.');
  }
  for (const player of state.players) {
    const owned = Object.values(state.tokens).filter((token) => token.owner === player.id);
    if (owned.length !== TOKENS_PER_PLAYER) throw new Error('Each Classic player must own four tokens.');
    for (const token of owned) {
      if (token.color !== player.color) throw new Error('Classic token color must match its owner.');
      positionFromStepProgress(token.stepProgress, CLASSIC_PROGRESS_CONFIG);
    }
  }
  if (!state.players.some((player) => player.id === state.currentPlayer)) {
    throw new Error('Current player missing.');
  }
  return true;
}
