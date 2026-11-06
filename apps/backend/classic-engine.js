import { COLORS, PLAYER_CONFIG, SAFE_TRACK_INDICES, CELL_COUNT } from '../../src/geometry.js';

export const TOKENS_PER_PLAYER = 4;
export const LAST_TRACK_STEP = 51;
export const LAST_HOME_STEP = 56;
export const FINISH_STEP = 57;

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
    id: player.id,
    color: player.color,
    username: String(player.username ?? player.id).slice(0, 40),
    characterId: String(player.characterId || 'optimist'),
    status: 'playing',
    finishedAt: null,
  }));
}

export function createClassicState(roster) {
  const players = assertRoster(roster);
  const tokens = {};
  for (const player of players) {
    for (let index = 0; index < TOKENS_PER_PLAYER; index += 1) {
      const id = `${player.id}:${index}`;
      tokens[id] = { id, owner: player.id, color: player.color, index, position: { zone: 'base', step: -1 } };
    }
  }
  return {
    mode: 'CLASSIC',
    phase: 'playing',
    players,
    tokens,
    currentPlayer: players[0].id,
    dice: null,
    consecutiveSixes: 0,
    winner: null,
    revision: 0,
    lastAction: null,
  };
}

export function globalTrackIndex(color, step) {
  const config = PLAYER_CONFIG[color];
  if (!config || !Number.isInteger(step) || step < 0 || step > LAST_TRACK_STEP) {
    throw new RangeError('Invalid outer-track position.');
  }
  return (config.start + step) % CELL_COUNT;
}

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId) ?? null;
}

function tokenDestination(token, dice) {
  if (token.position.zone === 'base') return dice === 6 ? { zone: 'track', step: 0 } : null;
  if (token.position.zone === 'finished') return null;
  const nextStep = token.position.step + dice;
  if (nextStep <= LAST_TRACK_STEP) return { zone: 'track', step: nextStep };
  if (nextStep <= LAST_HOME_STEP) return { zone: 'home', step: nextStep };
  if (nextStep === FINISH_STEP) return { zone: 'finished', step: FINISH_STEP };
  return null;
}

function trackTokensAt(state, globalIndex, exceptTokenId = null) {
  return Object.values(state.tokens).filter((token) =>
    token.id !== exceptTokenId && token.position.zone === 'track' &&
    globalTrackIndex(token.color, token.position.step) === globalIndex,
  );
}

function isBlockedAt(state, globalIndex, exceptTokenId = null) {
  const occupants = trackTokensAt(state, globalIndex, exceptTokenId);
  const countsByOwner = new Map();
  for (const token of occupants) countsByOwner.set(token.owner, (countsByOwner.get(token.owner) ?? 0) + 1);
  return [...countsByOwner.values()].some((count) => count >= 2);
}

function pathIsClear(state, token, destination) {
  if (token.position.zone !== 'track') return true;
  const lastOuterStep = Math.min(destination.step, LAST_TRACK_STEP);
  for (let step = token.position.step + 1; step <= lastOuterStep; step += 1) {
    const index = globalTrackIndex(token.color, step);
    if (isBlockedAt(state, index, token.id)) return false;
  }
  return true;
}

function canLand(state, token, destination) {
  if (destination.zone !== 'track') return true;
  const index = globalTrackIndex(token.color, destination.step);
  return !isBlockedAt(state, index, token.id);
}

export function buildOccupancy(state) {
  const occupancy = { track: {}, home: {}, base: {}, finished: {} };
  for (const token of Object.values(state.tokens)) {
    const { zone, step } = token.position;
    const key = zone === 'track'
      ? String(globalTrackIndex(token.color, step))
      : zone === 'home'
        ? `${token.color}:${step - 52}`
        : token.owner;
    (occupancy[zone][key] ??= []).push(token.id);
  }
  return occupancy;
}

export function legalMoves(state, playerId, dice = state.dice) {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId ||
      !playerById(state, playerId) || !Number.isInteger(dice) || dice < 1 || dice > 6) return [];
  return Object.values(state.tokens)
    .filter((token) => token.owner === playerId)
    .filter((token) => {
      const destination = tokenDestination(token, dice);
      return Boolean(destination && pathIsClear(state, token, destination) && canLand(state, token, destination));
    })
    .map((token) => token.id);
}

function nextActivePlayer(state, currentPlayerId) {
  const currentIndex = state.players.findIndex((player) => player.id === currentPlayerId);
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = state.players[(currentIndex + offset) % state.players.length];
    if (candidate.status !== 'finished') return candidate.id;
  }
  return currentPlayerId;
}

function copyState(state) {
  return structuredClone(state);
}

export function rollClassicDice(state, playerId, dice) {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId || state.dice !== null) {
    throw new Error('Dice cannot be rolled now.');
  }
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new RangeError('Dice must be an integer from 1 to 6.');
  const next = copyState(state);
  next.consecutiveSixes = dice === 6 ? next.consecutiveSixes + 1 : 0;
  next.lastAction = { type: 'ROLL', playerId, dice };
  next.revision += 1;

  if (next.consecutiveSixes === 3) {
    next.consecutiveSixes = 0;
    next.currentPlayer = nextActivePlayer(next, playerId);
    next.lastAction.skipped = true;
    return { state: next, legalTokenIds: [], skipped: true, bonusRoll: false, turnAdvanced: true };
  }

  next.dice = dice;
  const moves = legalMoves(next, playerId, dice);
  if (moves.length === 0) {
    next.dice = null;
    const bonusRoll = dice === 6;
    if (!bonusRoll) next.currentPlayer = nextActivePlayer(next, playerId);
    return { state: next, legalTokenIds: [], skipped: false, bonusRoll, turnAdvanced: !bonusRoll };
  }
  return { state: next, legalTokenIds: moves, skipped: false, bonusRoll: false, turnAdvanced: false };
}

export function applyClassicMove(state, playerId, tokenId) {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId || state.dice === null) {
    throw new Error('There is no pending move for this player.');
  }
  if (!legalMoves(state, playerId, state.dice).includes(tokenId)) throw new Error('Illegal move.');

  const next = copyState(state);
  const token = next.tokens[tokenId];
  const dice = next.dice;
  const from = structuredClone(token.position);
  const destination = tokenDestination(token, dice);
  token.position = destination;
  const captured = [];

  if (destination.zone === 'track') {
    const globalIndex = globalTrackIndex(token.color, destination.step);
    if (!SAFE_TRACK_INDICES.has(globalIndex)) {
      for (const enemy of Object.values(next.tokens)) {
        if (enemy.owner !== playerId && enemy.position.zone === 'track' &&
            globalTrackIndex(enemy.color, enemy.position.step) === globalIndex) {
          enemy.position = { zone: 'base', step: -1 };
          captured.push(enemy.id);
        }
      }
    }
  }

  const finishedCount = Object.values(next.tokens).filter((item) =>
    item.owner === playerId && item.position.zone === 'finished',
  ).length;
  const justFinished = destination.zone === 'finished';
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
  next.lastAction = { type: 'MOVE', playerId, tokenId, dice, from, to: structuredClone(destination), captured, bonusRoll };
  next.revision += 1;
  return { state: next, captured, bonusRoll, turnAdvanced: !bonusRoll && next.phase !== 'finished' };
}

export function assertClassicState(state) {
  if (!state || state.mode !== 'CLASSIC' || !Array.isArray(state.players) || !state.tokens) {
    throw new TypeError('Malformed Classic Ludo state.');
  }
  if (state.players.length < 2 || state.players.length > 4) throw new RangeError('Classic Ludo requires 2–4 players.');
  for (const player of state.players) {
    const owned = Object.values(state.tokens).filter((token) => token.owner === player.id);
    if (owned.length !== TOKENS_PER_PLAYER) throw new Error(`Player ${player.id} must own exactly four tokens.`);
    for (const token of owned) {
      const { zone, step } = token.position;
      if (zone === 'base' && step !== -1) throw new Error('Base token must have step -1.');
      if (zone === 'track' && (!Number.isInteger(step) || step < 0 || step > LAST_TRACK_STEP)) throw new Error('Invalid track step.');
      if (zone === 'home' && (!Number.isInteger(step) || step < 52 || step > LAST_HOME_STEP)) throw new Error('Invalid home step.');
      if (zone === 'finished' && step !== FINISH_STEP) throw new Error('Invalid finished position.');
      if (!['base', 'track', 'home', 'finished'].includes(zone)) throw new Error('Invalid token zone.');
    }
  }
  if (!state.players.some((player) => player.id === state.currentPlayer)) throw new Error('Current player is missing.');
  return true;
}
