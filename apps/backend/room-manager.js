import { randomBytes, randomInt } from 'node:crypto';
import { rollUniversalDice, applyUniversalMove, assertUniversalState, createUniversalState } from './universal-engine.js';
import { COLORS, PLAYER_CONFIG, SAFE_TRACK_INDICES, CELL_COUNT } from '../../src/geometry.js';
import { getPlayableGeometry } from '../../src/game-geometries.js';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../../src/characters.js';

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const CHAT_LIMIT = 50;
const CHAT_MAX_LENGTH = 200;

const BOT_CHARACTER_IDS = ['cat', 'owl', 'husky', 'raccoon', 'poison', 'nikita', 'lilya-detective', 'optimist'];

function botDestination(state, token, dice) {
  const trackLength = state.mode === 'CLASSIC' ? CELL_COUNT : state.trackLength;
  const finishStep = state.mode === 'CLASSIC' ? 57 : state.finishStep;
  if (token.position.zone === 'base') return dice === 6 ? { zone: 'track', step: 0 } : null;
  if (token.position.zone === 'finished') return null;
  const next = token.position.step + dice;
  if (next < trackLength) return { zone: 'track', step: next };
  if (next < finishStep) return { zone: 'home', step: next };
  if (next === finishStep) return { zone: 'finished', step: finishStep };
  return null;
}

function botGlobalTrackIndex(state, player, step) {
  return state.mode === 'CLASSIC'
    ? (PLAYER_CONFIG[player.color].start + step) % CELL_COUNT
    : (player.startIndex + step) % state.trackLength;
}

function chooseBotMove(state, playerId, legalTokenIds, dice) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) throw new Error('Bot player is missing from the current state.');
  const trackLength = state.mode === 'CLASSIC' ? CELL_COUNT : state.trackLength;
  const safe = new Set(state.mode === 'CLASSIC' ? SAFE_TRACK_INDICES : state.safeTrackIndices);
  const opponents = state.players.filter((item) => item.id !== playerId);
  const tokens = Object.values(state.tokens);
  let best = null;
  for (const tokenId of legalTokenIds) {
    const token = state.tokens[tokenId];
    const destination = botDestination(state, token, dice);
    if (!destination) continue;
    let score = 0;
    if (destination.zone === 'finished') score += 100_000;
    else if (destination.zone === 'home') score += 2_500 + destination.step;
    else if (destination.zone === 'track') {
      const target = botGlobalTrackIndex(state, player, destination.step);
      score += 300 + destination.step * 12;
      if (token.position.zone === 'base') score += 450;
      if (!safe.has(target)) {
        const captures = tokens.filter((enemy) => {
          if (enemy.owner === playerId || enemy.position.zone !== 'track') return false;
          const owner = state.players.find((item) => item.id === enemy.owner);
          return owner && botGlobalTrackIndex(state, owner, enemy.position.step) === target;
        });
        score += captures.length * 12_000;
      } else score += 80;
    }
    if (token.position.zone === 'track' && destination.zone === 'track') {
      score += (destination.step - token.position.step) * 4;
    }
    if (token.position.zone === 'home' && destination.zone === 'home') {
      score += (destination.step - token.position.step) * 8;
    }
    score += (3 - token.index) * 0.01;
    if (!best || score > best.score) best = { tokenId, score };
  }
  if (!best) throw new Error('Bot received a legal move list with no destination.');
  return best.tokenId;
}

export class RoomError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'RoomError'; this.code = code; this.status = status; }
}

export class RoomManager {
  constructor({ now = Date.now, maxRooms = 20, roomTtlMs = ROOM_TTL_MS, dice = () => randomInt(1, 7) } = {}) {
    if (typeof now !== 'function') throw new TypeError('now must be a function.');
    if (!Number.isInteger(maxRooms) || maxRooms < 1 || maxRooms > 500) throw new RangeError('maxRooms must be an integer from 1 to 500.');
    if (!Number.isFinite(roomTtlMs) || roomTtlMs <= 0) throw new RangeError('roomTtlMs must be positive.');
    if (typeof dice !== 'function') throw new TypeError('dice must be a function.');
    this.now = now;
    this.maxRooms = maxRooms;
    this.roomTtlMs = roomTtlMs;
    this.dice = dice;
    this.rooms = new Map();
  }

  createRoom(user, options = {}) {
    const requestedPlayers = options.maxPlayers;
    const requestedType = String(options.boardType || (requestedPlayers === 5 ? 'PENTA' : requestedPlayers === 6 ? 'HEX' : 'CLASSIC')).toUpperCase();
    if (!['CLASSIC', 'DIAMOND', 'PENTA', 'HEX'].includes(requestedType)) throw new RoomError('INVALID_ROOM_CONFIG', 'Неизвестный тип доски.');
    const maxPlayers = requestedPlayers ?? (requestedType === 'PENTA' ? 5 : requestedType === 'HEX' ? 6 : 4);
    const validCapacity = requestedType === 'CLASSIC'
      ? Number.isInteger(maxPlayers) && maxPlayers >= 2 && maxPlayers <= 4
      : requestedType === 'DIAMOND' ? maxPlayers === 4
        : maxPlayers === (requestedType === 'PENTA' ? 5 : 6);
    if (!validCapacity) throw new RoomError('INVALID_ROOM_CONFIG', 'Classic: 2–4, DIAMOND: ровно 4, PENTA: ровно 5, HEX: ровно 6.');
    this.pruneIdleRooms();
    if (this.rooms.size >= this.maxRooms) throw new RoomError('ROOM_LIMIT', 'Сейчас все игровые столы заняты. Попробуй позже.', 503);
    if (!user?.id || !user?.username) throw new RoomError('INVALID_USER', 'Не удалось определить игрока.');
    const colors = requestedType === 'CLASSIC' ? COLORS : getPlayableGeometry(requestedType).arms.map((arm) => arm.player.id);
    const roomId = randomBytes(8).toString('hex');
    const room = {
      id: roomId,
      hostId: user.id,
      status: 'lobby',
      boardType: requestedType,
      isPublic: Boolean(options.isPublic ?? true),
      maxPlayers,
      players: [{ id: user.id, username: user.username.slice(0, 40), color: colors[0], characterId: isCharacterId(user.characterId) ? user.characterId : DEFAULT_CHARACTER_ID }],
      state: null,
      legalTokenIds: [],
      chat: [],
      lastChatAt: new Map(),
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.rooms.set(roomId, room);
    return this.getSnapshot(roomId, user.id);
  }

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Игровой стол не найден.', 404);
    return room;
  }

  isMember(roomId, userId) {
    const room = this.rooms.get(roomId);
    return Boolean(room?.players.some((player) => player.id === userId && !player.isBot));
  }

  joinRoom(roomId, user) {
    const room = this.getRoom(roomId);
    const existing = room.players.find((player) => player.id === user.id);
    if (existing?.isBot) throw new RoomError('BOT_ID_RESERVED', 'Этот идентификатор принадлежит игровому боту.', 403);
    if (existing) return this.getSnapshot(roomId, user.id);
    if (room.status !== 'lobby') throw new RoomError('GAME_ALREADY_STARTED', 'Партия уже началась.');
    if (room.players.length >= room.maxPlayers) throw new RoomError('ROOM_FULL', 'В этом столе уже нет свободных мест.');
    const colors = room.boardType === 'CLASSIC' ? COLORS : getPlayableGeometry(room.boardType).arms.map((arm) => arm.player.id);
    const color = colors.find((candidate) => !room.players.some((player) => player.color === candidate));
    if (!color) throw new RoomError('ROOM_FULL', 'В этом столе уже нет свободных мест.');
    room.players.push({ id: user.id, username: String(user.username || user.id).slice(0, 40), color, characterId: isCharacterId(user.characterId) ? user.characterId : DEFAULT_CHARACTER_ID });
    room.updatedAt = this.now();
    return this.getSnapshot(roomId, user.id);
  }

  setCharacter(roomId, userId, characterId) {
    const room = this.getRoom(roomId);
    const player = this.assertMember(room, userId);
    if (!isCharacterId(characterId)) throw new RoomError('INVALID_CHARACTER', 'Неизвестный персонаж OPTIMIST.');
    player.characterId = characterId;
    const statePlayer = room.state?.players.find((entry) => entry.id === userId);
    if (statePlayer) statePlayer.characterId = characterId;
    room.updatedAt = this.now();
    return this.getSnapshot(roomId, userId);
  }

  startGame(roomId, userId) {
    const room = this.getRoom(roomId);
    if (room.hostId !== userId) throw new RoomError('HOST_ONLY', 'Начать партию может создатель стола.', 403);
    if (room.status !== 'lobby') throw new RoomError('GAME_ALREADY_STARTED', 'Партия уже началась.');
    this.fillBotSeats(room);
    room.state = createUniversalState(room.boardType, room.players);
    room.legalTokenIds = [];
    room.status = 'playing';
    room.updatedAt = this.now();
    this.runBotTurns(room);
    return this.getSnapshot(roomId, userId);
  }


  fillBotSeats(room) {
    const colors = room.boardType === 'CLASSIC'
      ? COLORS
      : getPlayableGeometry(room.boardType).arms.map((arm) => arm.player.id);
    while (room.players.length < room.maxPlayers) {
      const seat = room.players.length;
      room.players.push({
        id: `bot_${room.id}_${seat}`,
        username: `БОТ ${seat}`,
        color: colors[seat],
        characterId: BOT_CHARACTER_IDS[(seat - 1) % BOT_CHARACTER_IDS.length],
        isBot: true,
        botLevel: 'normal',
      });
    }
  }

  runBotTurns(room) {
    let actions = 0;
    while (room.status === 'playing' && actions < 80) {
      const player = room.players.find((item) => item.id === room.state?.currentPlayer);
      if (!player?.isBot) break;

      const rolled = rollUniversalDice(room.state, player.id, this.dice());
      room.state = rolled.state;
      room.legalTokenIds = [...rolled.legalTokenIds];
      actions += 1;

      if (room.state.phase === 'finished') {
        room.status = 'finished';
        room.legalTokenIds = [];
        break;
      }
      if (rolled.legalTokenIds.length === 0) {
        // A six with no legal move still grants a bonus roll; all other
        // no-move and three-sixes cases advance the turn in the engine.
        continue;
      }

      const tokenId = chooseBotMove(room.state, player.id, rolled.legalTokenIds, room.state.dice);
      const moved = applyUniversalMove(room.state, player.id, tokenId);
      assertUniversalState(moved.state);
      room.state = moved.state;
      room.legalTokenIds = [];
      actions += 1;
      if (moved.state.phase === 'finished') room.status = 'finished';
    }

    room.updatedAt = this.now();
  }

  roll(roomId, userId) {
    const room = this.getRoom(roomId);
    this.assertMember(room, userId);
    if (!room.state) throw new RoomError('GAME_NOT_STARTED', 'Сначала начни партию.');
    const result = rollUniversalDice(room.state, userId, this.dice());
    room.state = result.state;
    room.legalTokenIds = [...result.legalTokenIds];
    this.runBotTurns(room);
    room.updatedAt = this.now();
    return { ...result, snapshot: this.getSnapshot(roomId, userId) };
  }

  move(roomId, userId, tokenId) {
    const room = this.getRoom(roomId);
    this.assertMember(room, userId);
    if (!room.state) throw new RoomError('GAME_NOT_STARTED', 'Сначала начни партию.');
    const result = applyUniversalMove(room.state, userId, tokenId);
    assertUniversalState(result.state);
    room.state = result.state;
    room.legalTokenIds = [];
    if (result.state.phase === 'finished') room.status = 'finished';
    else this.runBotTurns(room);
    room.updatedAt = this.now();
    return { ...result, snapshot: this.getSnapshot(roomId, userId) };
  }

  sendChat(roomId, userId, text) {
    const room = this.getRoom(roomId);
    const player = this.assertMember(room, userId);
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) throw new RoomError('EMPTY_MESSAGE', 'Сообщение не должно быть пустым.');
    if (clean.length > CHAT_MAX_LENGTH) throw new RoomError('MESSAGE_TOO_LONG', 'Сообщение должно быть не длиннее 200 символов.');
    this.checkChatRate(room, userId, 800);
    return this.appendChat(room, player, clean, null);
  }

  assertVoiceAllowed(roomId, userId) {
    const room = this.getRoom(roomId);
    this.assertMember(room, userId);
    const last = room.lastChatAt.get(userId);
    if (last !== undefined && this.now() - last < 1_500) throw new RoomError('RATE_LIMIT', 'Подожди немного перед следующим сообщением.', 429);
    return true;
  }

  sendVoice(roomId, userId, voice) {
    const room = this.getRoom(roomId);
    const player = this.assertMember(room, userId);
    if (!voice || !/^[a-f0-9]{32}$/.test(voice.id) || !Number.isInteger(voice.durationSeconds) ||
        voice.durationSeconds < 1 || voice.durationSeconds > 30 || !Number.isInteger(voice.sizeBytes) ||
        voice.sizeBytes < 256 || voice.sizeBytes > 512 * 1024 ||
        !['audio/webm', 'audio/ogg', 'audio/mp4'].includes(voice.mimeType)) {
      throw new RoomError('INVALID_VOICE_MESSAGE', 'Голосовое сообщение имеет неподдерживаемый формат.');
    }
    this.checkChatRate(room, userId, 1_500);
    return this.appendChat(room, player, '🎙️ Голосовое сообщение', { ...voice });
  }

  checkChatRate(room, userId, intervalMs) {
    const now = this.now();
    const last = room.lastChatAt.get(userId);
    if (last !== undefined && now - last < intervalMs) throw new RoomError('RATE_LIMIT', 'Подожди немного перед следующим сообщением.');
    room.lastChatAt.set(userId, now);
  }

  appendChat(room, player, text, voice) {
    const message = {
      id: randomBytes(8).toString('hex'), roomId: room.id,
      senderId: player.id, senderName: player.username, text,
      senderType: 'PLAYER', timestamp: this.now(),
      ...(voice ? { voice } : {}),
    };
    room.chat.push(message);
    if (room.chat.length > CHAT_LIMIT) room.chat.splice(0, room.chat.length - CHAT_LIMIT);
    room.updatedAt = this.now();
    return message;
  }

  assertMember(room, userId) {
    const player = room.players.find((entry) => entry.id === userId && !entry.isBot);
    if (!player) throw new RoomError('NOT_A_MEMBER', 'Ты не участник этого стола.', 403);
    return player;
  }

  getSnapshot(roomId, viewerId) {
    const room = this.getRoom(roomId);
    this.assertMember(room, viewerId);
    return {
      roomId: room.id, hostId: room.hostId, status: room.status,
      boardType: room.boardType, isPublic: room.isPublic, maxPlayers: room.maxPlayers,
      players: room.players.map((player) => ({ ...player })),
      state: room.state ? structuredClone(room.state) : null,
      legalTokenIds: [...room.legalTokenIds],
      chat: room.chat.map((message) => structuredClone(message)),
      createdAt: room.createdAt, updatedAt: room.updatedAt,
    };
  }

  listPublicRooms() {
    this.pruneIdleRooms();
    return [...this.rooms.values()].filter((room) => room.isPublic && room.status === 'lobby').map((room) => ({
      roomId: room.id, boardType: room.boardType, players: room.players.length, maxPlayers: room.maxPlayers, createdAt: room.createdAt,
    }));
  }

  pruneIdleRooms() {
    const cutoff = this.now() - this.roomTtlMs;
    for (const [roomId, room] of this.rooms) if (room.updatedAt < cutoff) this.rooms.delete(roomId);
  }
}
