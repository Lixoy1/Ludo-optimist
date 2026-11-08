import { randomBytes, randomInt } from 'node:crypto';
import { rollUniversalDice, applyUniversalMove, assertUniversalState, createUniversalState, extendedGlobalTrackIndex } from './universal-engine.js';
import { globalTrackIndex as classicGlobalTrackIndex } from './classic-engine.js';
import { calculateDestinationProgress, isOuterTrackProgress, positionFromStepProgress, progressConfigForState } from '../../src/game-progress.js';
import { COLORS, PLAYER_CONFIG, SAFE_TRACK_INDICES, CELL_COUNT } from '../../src/geometry.js';
import { getPlayableGeometry } from '../../src/game-geometries.js';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../../src/characters.js';

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const CHAT_LIMIT = 50;
const CHAT_MAX_LENGTH = 200;
const MAX_OBSERVERS_PER_ROOM = 100;

const BOT_CHARACTER_IDS = ['cat', 'owl', 'husky', 'raccoon', 'poison', 'nikita', 'lilya-detective', 'optimist'];

function botDestination(state, token, dice) {
  const config = progressConfigForState(state);
  const destination = calculateDestinationProgress(token.stepProgress, dice, config);
  return destination === null ? null : positionFromStepProgress(destination, config);
}

function botGlobalTrackIndex(state, player, stepProgress) {
  return state.mode === 'CLASSIC'
    ? classicGlobalTrackIndex(player.color, stepProgress)
    : extendedGlobalTrackIndex(state, player, stepProgress);
}

function chooseBotMove(state, playerId, legalTokenIds, dice) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) throw new Error('Bot player is missing from the current state.');
  const config = progressConfigForState(state);
  const safe = new Set(state.mode === 'CLASSIC' ? SAFE_TRACK_INDICES : state.safeTrackIndices);
  const tokens = Object.values(state.tokens);
  let best = null;
  for (const tokenId of legalTokenIds) {
    const token = state.tokens[tokenId];
    const position = positionFromStepProgress(token.stepProgress, config);
    const destination = botDestination(state, token, dice);
    if (!destination) continue;
    let score = 0;
    if (destination.zone === 'finished') score += 100_000;
    else if (destination.zone === 'home') score += 2_500 + destination.step;
    else if (destination.zone === 'track') {
      const target = botGlobalTrackIndex(state, player, destination.step);
      score += 300 + destination.step * 12;
      if (position.zone === 'base') score += 450;
      if (!safe.has(target)) {
        const captures = tokens.filter((enemy) => {
          if (enemy.owner === playerId || !isOuterTrackProgress(enemy.stepProgress, config)) return false;
          const owner = state.players.find((item) => item.id === enemy.owner);
          return owner && botGlobalTrackIndex(state, owner, enemy.stepProgress) === target;
        });
        score += captures.length * 12_000;
      } else score += 80;
    }
    if (position.zone === 'track' && destination.zone === 'track') {
      score += (destination.step - token.stepProgress) * 4;
    }
    if (position.zone === 'home' && destination.zone === 'home') {
      score += (destination.step - token.stepProgress) * 8;
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
    const requestedType = String(options.boardType || (requestedPlayers === 6 ? 'HEXA' : 'CLASSIC')).toUpperCase();
    if (!['CLASSIC', 'HEXA'].includes(requestedType)) throw new RoomError('INVALID_ROOM_CONFIG', 'Неизвестный тип доски.');
    const maxPlayers = requestedPlayers ?? (requestedType === 'HEXA' ? 6 : 4);
    const validCapacity = requestedType === 'CLASSIC'
      ? Number.isInteger(maxPlayers) && maxPlayers >= 2 && maxPlayers <= 4
      : requestedType === 'HEXA' ? maxPlayers === 6 : false;
    if (!validCapacity) throw new RoomError('INVALID_ROOM_CONFIG', 'Classic: 2–4, HEXA: ровно 6.');
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
      observers: [],
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

  isObserver(roomId, userId) {
    const room = this.rooms.get(roomId);
    return Boolean(room?.observers?.some((observer) => observer.id === userId));
  }

  isChatParticipant(roomId, userId) {
    return this.isMember(roomId, userId) || this.isObserver(roomId, userId);
  }

  getRole(roomId, userId) {
    if (this.isMember(roomId, userId)) return 'PLAYER';
    if (this.isObserver(roomId, userId)) return 'OBSERVER';
    throw new RoomError('NOT_A_MEMBER', 'Нет доступа к этой игре.', 403);
  }

  joinAsObserver(roomId, user) {
    const room = this.getRoom(roomId);
    if (!user?.id || !user?.username) throw new RoomError('INVALID_USER', 'Не удалось определить наблюдателя.');
    if (room.players.some((player) => player.id === user.id && player.isBot)) {
      throw new RoomError('BOT_ID_RESERVED', 'Этот идентификатор принадлежит игровому боту.', 403);
    }
    if (this.isMember(roomId, user.id) || this.isObserver(roomId, user.id)) {
      return this.getSnapshot(roomId, user.id);
    }
    if (room.observers.length >= MAX_OBSERVERS_PER_ROOM) {
      throw new RoomError('OBSERVER_LIMIT', 'В игре слишком много наблюдателей. Попробуй позже.', 503);
    }
    room.observers.push({
      id:user.id,
      username:String(user.username || user.id).slice(0,40),
      joinedAt:this.now(),
    });
    room.updatedAt = this.now();
    return this.getSnapshot(roomId, user.id);
  }

  joinRoom(roomId, user) {
    const room = this.getRoom(roomId);
    const existing = room.players.find((player) => player.id === user.id);
    if (existing?.isBot) throw new RoomError('BOT_ID_RESERVED', 'Этот идентификатор принадлежит игровому боту.', 403);
    if (existing) return this.getSnapshot(roomId, user.id);
    if (room.status !== 'lobby') throw new RoomError('GAME_ALREADY_STARTED', 'Партия уже началась.');
    if (room.players.length >= room.maxPlayers) throw new RoomError('ROOM_FULL', 'В этом столе уже нет свободных мест.');
    room.observers = room.observers.filter((observer) => observer.id !== user.id);
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
    const sender = this.assertChatParticipant(room, userId);
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) throw new RoomError('EMPTY_MESSAGE', 'Сообщение не должно быть пустым.');
    if (clean.length > CHAT_MAX_LENGTH) throw new RoomError('MESSAGE_TOO_LONG', 'Сообщение должно быть не длиннее 200 символов.');
    this.checkChatRate(room, userId, 800);
    return this.appendChat(room, sender, clean, null);
  }

  assertVoiceAllowed(roomId, userId) {
    const room = this.getRoom(roomId);
    this.assertChatParticipant(room, userId);
    const last = room.lastChatAt.get(userId);
    if (last !== undefined && this.now() - last < 1_500) throw new RoomError('RATE_LIMIT', 'Подожди немного перед следующим сообщением.', 429);
    return true;
  }

  sendVoice(roomId, userId, voice) {
    const room = this.getRoom(roomId);
    const sender = this.assertChatParticipant(room, userId);
    if (!voice || !/^[a-f0-9]{32}$/.test(voice.id) || !Number.isInteger(voice.durationSeconds) ||
        voice.durationSeconds < 1 || voice.durationSeconds > 30 || !Number.isInteger(voice.sizeBytes) ||
        voice.sizeBytes < 256 || voice.sizeBytes > 512 * 1024 ||
        !['audio/webm', 'audio/ogg', 'audio/mp4'].includes(voice.mimeType)) {
      throw new RoomError('INVALID_VOICE_MESSAGE', 'Голосовое сообщение имеет неподдерживаемый формат.');
    }
    this.checkChatRate(room, userId, 1_500);
    return this.appendChat(room, sender, '🎙️ Голосовое сообщение', { ...voice });
  }

  checkChatRate(room, userId, intervalMs) {
    const now = this.now();
    const last = room.lastChatAt.get(userId);
    if (last !== undefined && now - last < intervalMs) throw new RoomError('RATE_LIMIT', 'Подожди немного перед следующим сообщением.');
    room.lastChatAt.set(userId, now);
  }

  appendChat(room, sender, text, voice) {
    const message = {
      id: randomBytes(8).toString('hex'), roomId: room.id,
      senderId: sender.id, senderName: sender.username, text,
      senderType: sender.role, timestamp: this.now(),
      ...(sender.color ? { senderColor:sender.color } : {}),
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

  assertChatParticipant(room, userId) {
    const player = room.players.find((entry) => entry.id === userId && !entry.isBot);
    if (player) return { ...player, role:'PLAYER' };
    const observer = room.observers.find((entry) => entry.id === userId);
    if (observer) return { ...observer, role:'OBSERVER' };
    throw new RoomError('NOT_A_MEMBER', 'Ты не подключён к этой игре.', 403);
  }

  getSnapshot(roomId, viewerId) {
    const room = this.getRoom(roomId);
    const viewerRole = this.getRole(roomId, viewerId);
    return {
      roomId: room.id, hostId: room.hostId, status: room.status,
      boardType: room.boardType, isPublic: room.isPublic, maxPlayers: room.maxPlayers,
      viewerRole,
      players: room.players.map((player) => ({ ...player })),
      observers: room.observers.map((observer) => ({ id:observer.id, username:observer.username })),
      observerCount:room.observers.length,
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
