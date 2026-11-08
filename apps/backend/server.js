import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager, RoomError } from './room-manager.js';
import { VoiceStore, VoiceStoreError } from './voice-store.js';
import { ResumeStore } from './resume-store.js';
import { AuthError, authenticateHttpRequest, verifyTelegramInitData } from './telegram-auth.js';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../../src/characters.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const WS_AUTH_TIMEOUT_MS = 10_000;
const WS_RATE_WINDOW_MS = 10_000;
const WS_MAX_MESSAGES_PER_WINDOW = 60;
const MAX_ACTIVE_SOCKETS = 100;
const MAX_CONCURRENT_VOICE_UPLOADS = 4;
const VOICE_MIME_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4']);

function writeJson(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

function errorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status :
    error instanceof AuthError ? 401 : error instanceof RoomError ? 400 : error instanceof VoiceStoreError ? error.status : 500;
  return { status, body: {
    event: 'ERROR',
    code: typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR',
    message: status === 500 ? 'Внутренняя ошибка сервера.' : String(error.message || 'Запрос не выполнен.'),
  } };
}

async function readJson(req, maxBytes = 8 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Слишком большой запрос.'), { code: 'PAYLOAD_TOO_LARGE', status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Некорректный JSON.'), { code: 'INVALID_JSON', status: 400 }); }
}

async function readBinary(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new VoiceStoreError('PAYLOAD_TOO_LARGE', 'Голосовое сообщение превышает 512 КиБ.', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(ws, event, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event, payload }));
}

function roomPath(pathname) {
  return /^\/api\/rooms\/([a-f0-9]{16})(?:\/voice(?:\/([a-f0-9]{32}))?)?$/.exec(pathname);
}

export function createLudoServer({
  botToken = process.env.BOT_TOKEN,
  allowDevAuth = process.env.ALLOW_DEV_AUTH === '1',
  port = Number(process.env.PORT || 3000),
  host = process.env.HOST || '0.0.0.0',
  maxRooms = Number(process.env.MAX_ROOMS || 20),
  roomTtlMs = Number(process.env.ROOM_TTL_MS || 6 * 60 * 60 * 1000),
  allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
  now = Date.now,
  dice,
} = {}) {
  if (!botToken && (!allowDevAuth || process.env.NODE_ENV === 'production')) {
    throw new Error('Для production обязателен BOT_TOKEN. ALLOW_DEV_AUTH разрешён только для локальной разработки.');
  }
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('В production обязательно укажи ALLOWED_ORIGINS.');
  }

  const rooms = new RoomManager({ now, maxRooms, roomTtlMs, ...(dice ? { dice } : {}) });
  const voices = new VoiceStore({ now });
  const resumes = new ResumeStore({ now });
  const voiceSessions = new Map();
  const sessions = new Map();
  const roomSockets = new Map();
  let activeVoiceUploads = 0;

  function socketsFor(roomId) {
    let set = roomSockets.get(roomId);
    if (!set) { set = new Set(); roomSockets.set(roomId, set); }
    return set;
  }

  function broadcastRoom(roomId) {
    for (const ws of roomSockets.get(roomId) ?? []) {
      const session = sessions.get(ws);
      if (!session?.userId) continue;
      try { send(ws, 'ROOM_SYNC', rooms.getSnapshot(roomId, session.userId)); }
      catch { ws.close(4403, 'Room access revoked'); }
    }
  }

  function broadcastChat(roomId, message) {
    for (const ws of roomSockets.get(roomId) ?? []) send(ws, 'CHAT_MESSAGE', message);
  }

  function getVoiceSession(req, roomId) {
    const token = req.headers['x-room-session'];
    if (typeof token !== 'string') throw new AuthError('VOICE_SESSION_REQUIRED', 'Сначала подключись к игровому столу.');
    const session = voiceSessions.get(token);
    if (!session || session.roomId !== roomId) {
      throw new AuthError('INVALID_VOICE_SESSION', 'Сессия голосового чата устарела. Переподключись к столу.');
    }
    rooms.getSnapshot(roomId, session.userId); // membership is revalidated on every upload and playback.
    return session;
  }

  async function handleVoice(req, res, url, match) {
    const roomId = match[1];
    const voiceId = match[2];
    try {
      if (req.method !== 'POST' && req.method !== 'GET') {
        req.resume();
        res.writeHead(405, { allow: 'GET, POST' }); res.end(); return true;
      }
      const session = getVoiceSession(req, roomId);
      if (req.method === 'POST') {
        if (voiceId) { req.resume(); writeJson(res, 404, { error: 'Not found' }); return true; }
        rooms.assertVoiceAllowed(roomId, session.userId);
        if (activeVoiceUploads >= MAX_CONCURRENT_VOICE_UPLOADS) throw new VoiceStoreError('VOICE_UPLOAD_BUSY', 'Сервер сейчас обрабатывает несколько голосовых. Попробуй ещё раз.', 503);
        const mimeType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        if (!VOICE_MIME_TYPES.has(mimeType)) throw new VoiceStoreError('UNSUPPORTED_MEDIA_TYPE', 'Поддерживаются записи WebM, OGG и MP4.', 415);
        const durationSeconds = Number(req.headers['x-voice-duration']);
        const declaredLength = Number(req.headers['content-length'] || 0);
        if (declaredLength > voices.limits.maxFileBytes) throw new VoiceStoreError('PAYLOAD_TOO_LARGE', 'Голосовое сообщение превышает 512 КиБ.', 413);
        activeVoiceUploads += 1;
        try {
          const buffer = await readBinary(req, voices.limits.maxFileBytes);
          const stored = voices.put({ roomId, buffer, mimeType, durationSeconds });
          let message;
          try {
            message = rooms.sendVoice(roomId, session.userId, {
              id: stored.id, durationSeconds, mimeType, sizeBytes: stored.sizeBytes,
            });
          } catch (error) {
            voices.remove(stored.id);
            throw error;
          }
          broadcastChat(roomId, message);
          writeJson(res, 201, { voiceId: stored.id, message });
          return true;
        } finally {
          activeVoiceUploads = Math.max(0, activeVoiceUploads - 1);
        }
      }
      if (!voiceId) { writeJson(res, 404, { error: 'Not found' }); return true; }
      const file = voices.get(roomId, voiceId);
      if (!file) { writeJson(res, 404, { error: 'Голосовое сообщение уже недоступно.' }); return true; }
      res.writeHead(200, {
        'content-type': file.mimeType,
        'content-length': file.buffer.length,
        'content-disposition': 'inline',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      });
      res.end(file.buffer);
      return true;
    } catch (error) {
      req.resume();
      const result = errorResponse(error);
      writeJson(res, result.status, result.body);
      return true;
    }
  }

  async function handleHttp(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/healthz') {
      writeJson(res, 200, { status: 'ok', service: 'optimist-ludo', rooms: rooms.rooms.size, activeSockets: sessions.size, activeVoiceUploads, voice: voices.getStats(), resumes: resumes.getStats(), uptimeSeconds: Math.floor(process.uptime()) });
      return;
    }
    const match = roomPath(url.pathname);
    if (match && url.pathname.includes('/voice')) {
      if (await handleVoice(req, res, url, match)) return;
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        const user = authenticateHttpRequest(req, { botToken, allowDevAuth });
        if (req.method === 'GET' && url.pathname === '/api/rooms') {
          writeJson(res, 200, { rooms: rooms.listPublicRooms() });
          return;
        }
        if (req.method === 'POST' && url.pathname === '/api/rooms') {
          const body = await readJson(req);
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RoomError('INVALID_ROOM_CONFIG', 'Тело запроса должно быть JSON-объектом.');
          const requestedType = String(body.boardType || (body.maxPlayers === 6 ? 'HEXA' : 'CLASSIC')).toUpperCase();
          const requestedPlayers = body.maxPlayers ?? (requestedType === 'HEXA' ? 6 : 4);
          const validBoardCapacity = requestedType === 'CLASSIC'
            ? Number.isInteger(requestedPlayers) && requestedPlayers >= 2 && requestedPlayers <= 4
            : requestedType === 'HEXA' ? requestedPlayers === 6
              : requestedType === 'ROYAL' ? requestedPlayers === 4 : false;
          if (!validBoardCapacity) {
            throw new RoomError('INVALID_ROOM_CONFIG', 'Classic: 2–4, HEXA: ровно 6, ROYAL: ровно 4.');
          }
          if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean') {
            throw new RoomError('INVALID_ROOM_CONFIG', 'isPublic должен быть логическим значением.');
          }
          const characterId = body.characterId ?? DEFAULT_CHARACTER_ID;
          if (!isCharacterId(characterId)) throw new RoomError('INVALID_CHARACTER', 'Неизвестный персонаж OPTIMIST.');
          const snapshot = rooms.createRoom({ ...user, characterId }, {
            boardType: requestedType,
            maxPlayers: requestedPlayers,
            isPublic: body.isPublic ?? true,
          });
          writeJson(res, 201, { roomId: snapshot.roomId, snapshot });
          return;
        }
        if (req.method === 'GET' && match && !url.pathname.includes('/voice')) {
          writeJson(res, 200, { snapshot: rooms.getSnapshot(match[1], user.id) });
          return;
        }
        req.resume();
        writeJson(res, 404, { error: 'Not found' });
      } catch (error) {
        req.resume();
        const result = errorResponse(error);
        writeJson(res, result.status, result.body);
      }
      return;
    }

    if (req.method !== 'GET') { writeJson(res, 404, { error: 'Not found' }); return; }
    let relativePath;
    try { relativePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
    catch { writeJson(res, 400, { error: 'Malformed path' }); return; }
    if (relativePath.includes('..') || relativePath.includes('\\\\') || relativePath.startsWith('/apps/') || relativePath.startsWith('/tests/') || relativePath.startsWith('/.')) {
      writeJson(res, 403, { error: 'Forbidden' }); return; }
    const filePath = resolve(PROJECT_ROOT, `.${relativePath}`);
    const rel = relative(PROJECT_ROOT, filePath);
    if (rel.startsWith(`..${sep}`) || rel === '..' || rel === '') { writeJson(res, 403, { error: 'Forbidden' }); return; }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) { writeJson(res, 404, { error: 'Not found' }); return; }
      const body = await readFile(filePath);
      const type = {
        '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
      }[extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=86400' });
      res.end(body);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') writeJson(res, 404, { error: 'Not found' });
      else { console.error('[http] static:', error.message); writeJson(res, 500, { error: 'Internal server error' }); }
    }
  }

  const server = createServer((req, res) => {
    void handleHttp(req, res).catch((error) => {
      console.error('[http] request:', error.message);
      if (!res.headersSent) writeJson(res, 500, { error: 'Internal server error' }); else res.destroy();
    });
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 20 * 1024, perMessageDeflate: false });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws') { socket.write('HTTP/1.1 404 Not Found\\r\\nConnection: close\\r\\n\\r\\n'); socket.destroy(); return; }
    const origin = request.headers.origin;
    if (allowedOrigins.length && (!origin || !allowedOrigins.includes(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\\r\\nConnection: close\\r\\n\\r\\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws));
  });

  async function handleWsMessage(ws, session, raw) {
    if (Buffer.byteLength(raw) > 20 * 1024) throw new Error('Сообщение превышает 20 КиБ.');
    let message;
    try { message = JSON.parse(raw.toString()); } catch { throw new Error('Некорректное сообщение.'); }
    if (!session.userId) {
      if (!message || typeof message !== 'object' || Array.isArray(message) || message.type !== 'AUTH' || typeof message.roomId !== 'string') {
        throw new AuthError('AUTH_REQUIRED', 'Сначала авторизуйся через Telegram.');
      }
      let user;
      const resumed = resumes.get(message.resumeToken, message.roomId);
      if (resumed) {
        user = { id: resumed.userId, username: resumed.username };
        rooms.getSnapshot(message.roomId, user.id);
        resumes.remove(message.resumeToken);
      } else if (allowDevAuth && process.env.NODE_ENV !== 'production' && typeof message.devUserId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(message.devUserId)) {
        user = { id: message.devUserId, username: String(message.devUsername || message.devUserId).slice(0, 40) };
      } else user = verifyTelegramInitData(message.initData, botToken);
      const requestedCharacter = isCharacterId(message.characterId) ? message.characterId : DEFAULT_CHARACTER_ID;
      const requestedObserver = message.role === 'OBSERVER' || message.observer === true;
      if (requestedObserver) {
        rooms.joinAsObserver(message.roomId, user);
      } else if (!rooms.isMember(message.roomId, user.id)) {
        try {
          rooms.joinRoom(message.roomId, { ...user, characterId: requestedCharacter });
        } catch (error) {
          if (error?.code !== 'GAME_ALREADY_STARTED' && error?.code !== 'ROOM_FULL') throw error;
          rooms.joinAsObserver(message.roomId, user);
        }
      } else if (isCharacterId(message.characterId)) {
        rooms.setCharacter(message.roomId, user.id, requestedCharacter);
      }
      session.userId = user.id;
      session.username = user.username;
      session.role = rooms.getRole(message.roomId, user.id);
      session.roomId = message.roomId;
      session.voiceToken = randomBytes(32).toString('hex');
      voiceSessions.set(session.voiceToken, { userId: user.id, roomId: message.roomId, role:session.role });
      session.resumeToken = resumes.issue({ userId: user.id, username: user.username, roomId: message.roomId }).token;
      socketsFor(message.roomId).add(ws);
      send(ws, 'AUTH_OK', { userId: user.id, username: user.username, role:session.role, roomId: message.roomId, voiceSessionToken: session.voiceToken, resumeToken: session.resumeToken });
      send(ws, 'ROOM_SYNC', rooms.getSnapshot(message.roomId, user.id));
      broadcastRoom(message.roomId);
      return;
    }

    const { userId, roomId } = session;
    switch (message.type) {
      case 'PING':
        send(ws, 'PONG', { at: now() });
        return;
      case 'START_GAME':
        rooms.startGame(roomId, userId);
        broadcastRoom(roomId);
        return;
      case 'ROLL_DICE': {
        const result = rooms.roll(roomId, userId);
        send(ws, 'ROLL_RESULT', { dice: result.state.lastAction?.dice, legalTokenIds: result.legalTokenIds, skipped: result.skipped, bonusRoll: result.bonusRoll });
        broadcastRoom(roomId);
        return;
      }
      case 'MOVE_TOKEN':
        rooms.move(roomId, userId, message.tokenId);
        broadcastRoom(roomId);
        return;
      case 'SET_CHARACTER':
        rooms.setCharacter(roomId, userId, message.characterId);
        broadcastRoom(roomId);
        return;
      case 'SEND_CHAT': {
        const chatMessage = rooms.sendChat(roomId, userId, message.text);
        broadcastChat(roomId, chatMessage);
        return;
      }
      default: throw Object.assign(new Error('Неизвестная команда.'), { code: 'UNKNOWN_MESSAGE' });
    }
  }

  wss.on('connection', (ws) => {
    if (sessions.size >= MAX_ACTIVE_SOCKETS) {
      console.warn('[ws] connection rejected: capacity reached');
      ws.close(1013, 'Server is busy');
      return;
    }
    const session = { userId: null, username:null, role:null, roomId: null, voiceToken: null, resumeToken: null, alive: true, frameTimes: [], authTimer: null, connectedAt: now() };
    console.info('[ws] connected');
    session.authTimer = setTimeout(() => ws.close(4401, 'Authentication timeout'), WS_AUTH_TIMEOUT_MS);
    session.authTimer.unref?.();
    sessions.set(ws, session);
    ws.on('pong', () => { session.alive = true; });
    let queue = Promise.resolve();
    ws.on('message', (raw) => {
      queue = queue.then(async () => {
        const current = now();
        session.frameTimes = session.frameTimes.filter((time) => current - time < WS_RATE_WINDOW_MS);
        session.frameTimes.push(current);
        if (session.frameTimes.length > WS_MAX_MESSAGES_PER_WINDOW) { ws.close(4429, 'Rate limit exceeded'); return; }
        try {
          await handleWsMessage(ws, session, Buffer.isBuffer(raw) ? raw : Buffer.from(raw));
          if (session.userId) clearTimeout(session.authTimer);
        } catch (error) {
          const result = errorResponse(error);
          send(ws, 'ERROR', result.body);
          if (!session.userId || error instanceof AuthError || session.frameTimes.length > WS_MAX_MESSAGES_PER_WINDOW) ws.close(4400, 'Invalid client message');
        }
      }).catch((error) => {
        console.error('[ws] message:', error.message);
        send(ws, 'ERROR', { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера.' });
      });
    });
    ws.on('close', (code, reason) => {
      clearTimeout(session.authTimer);
      if (session.userId) {
        console.info('[ws] disconnected', JSON.stringify({ userId: session.userId, roomId: session.roomId, code, reason: reason.toString().slice(0, 120), connectedSeconds: Math.max(0, Math.floor((now() - session.connectedAt) / 1000)) }));
      }
      sessions.delete(ws);
      if (session.voiceToken) voiceSessions.delete(session.voiceToken);
      if (session.roomId) {
        const set = roomSockets.get(session.roomId);
        set?.delete(ws);
        if (set?.size === 0) roomSockets.delete(session.roomId);
      }
    });
    ws.on('error', (error) => console.warn('[ws] socket:', error.message));
  });

  const heartbeat = setInterval(() => {
    for (const [ws, session] of sessions) {
      if (!session.alive) { ws.terminate(); continue; }
      session.alive = false;
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
  }, 30_000);
  heartbeat.unref?.();
  const cleanup = setInterval(() => { rooms.pruneIdleRooms(); voices.prune(); resumes.prune(); }, 5 * 60_000);
  cleanup.unref?.();

  return {
    server, rooms, voices, resumes,
    async listen() {
      await new Promise((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => { server.off('error', reject); resolveListen(); });
      });
      return server.address();
    },
    async close() {
      clearInterval(heartbeat); clearInterval(cleanup);
      for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
      await new Promise((resolveClose) => server.close(() => resolveClose()));
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createLudoServer();
  const bootAt = new Date().toISOString();
  app.listen().then((address) => console.log(`[OPTIMIST LUDO] cold-start ${bootAt}; listening on ${JSON.stringify(address)}`));
  const shutdown = () => { void app.close().then(() => process.exit(0)); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
