import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createLudoServer } from '../apps/backend/server.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Smoke test uses local development auth. Unset NODE_ENV=production first.');
}

const app = createLudoServer({
  botToken: '123456:local-smoke-token',
  allowDevAuth: true,
  host: '127.0.0.1',
  port: 0,
  allowedOrigins: [],
  dice: () => 6,
});

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName}.`));
    }, timeoutMs);
    const onMessage = (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }
      if (data.event === 'ERROR') {
        cleanup();
        reject(new Error(data.payload?.message || data.message || 'WebSocket returned ERROR.'));
        return;
      }
      if (data.event === eventName && predicate(data.payload, data)) {
        cleanup();
        resolve(data.payload);
      }
    };
    const onError = (error) => { cleanup(); reject(error); };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('message', onMessage);
      socket.off('error', onError);
    };
    socket.on('message', onMessage);
    socket.on('error', onError);
  });
}

async function openRoomSocket(url, auth) {
  const socket = new WebSocket(url);
  const open = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  await open;
  const authOk = waitForEvent(socket, 'AUTH_OK');
  const roomSync = waitForEvent(socket, 'ROOM_SYNC');
  socket.send(JSON.stringify({ type: 'AUTH', ...auth }));
  const authPayload = await authOk;
  const snapshot = await roomSync;
  return { socket, authPayload, snapshot };
}

async function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    socket.once('close', resolve);
    socket.close(1000, 'smoke test done');
  });
}

let hostSocket;
let playerSocket;
try {
  const address = await app.listen();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const wsUrl = `ws://127.0.0.1:${address.port}/ws`;

  const createdResponse = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dev-user': 'smoke-host', 'x-dev-name': 'Smoke Host' },
    body: JSON.stringify({ maxPlayers: 2, isPublic: true, characterId: 'poison' }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const roomId = created.roomId;

  const lobbyResponse = await fetch(`${baseUrl}/api/rooms`, { headers: { 'x-dev-user': 'smoke-host' } });
  assert.equal(lobbyResponse.status, 200);
  assert.equal((await lobbyResponse.json()).rooms.length, 1);

  const host = await openRoomSocket(wsUrl, { roomId, devUserId: 'smoke-host', devUsername: 'Smoke Host', characterId: 'poison' });
  hostSocket = host.socket;
  const player = await openRoomSocket(wsUrl, { roomId, devUserId: 'smoke-player', devUsername: 'Smoke Player', characterId: 'natalie' });
  playerSocket = player.socket;
  assert.equal(player.snapshot.players.length, 2);
  assert.equal(player.snapshot.players.find((entry) => entry.id === 'smoke-host').characterId, 'poison');
  assert.equal(player.snapshot.players.find((entry) => entry.id === 'smoke-player').characterId, 'natalie');

  const characterSync = waitForEvent(hostSocket, 'ROOM_SYNC', (payload) => payload?.players?.some((entry) => entry.id === 'smoke-player' && entry.characterId === 'elvina'));
  playerSocket.send(JSON.stringify({ type: 'SET_CHARACTER', characterId: 'elvina' }));
  const changedCharacter = await characterSync;
  assert.equal(changedCharacter.players.find((entry) => entry.id === 'smoke-player').characterId, 'elvina');

  const hostStarted = waitForEvent(hostSocket, 'ROOM_SYNC', (payload) => payload?.status === 'playing');
  hostSocket.send(JSON.stringify({ type: 'START_GAME' }));
  assert.equal((await hostStarted).status, 'playing');

  const rollResult = waitForEvent(hostSocket, 'ROLL_RESULT');
  const afterRoll = waitForEvent(hostSocket, 'ROOM_SYNC', (payload) => payload?.state?.dice === 6 && payload?.legalTokenIds?.length === 4);
  hostSocket.send(JSON.stringify({ type: 'ROLL_DICE' }));
  const roll = await rollResult;
  const rolledSnapshot = await afterRoll;
  assert.equal(roll.dice, 6);
  assert.equal(rolledSnapshot.legalTokenIds.length, 4);

  const moved = waitForEvent(hostSocket, 'ROOM_SYNC', (payload) => payload?.state?.tokens?.['smoke-host:0']?.position?.step === 0);
  hostSocket.send(JSON.stringify({ type: 'MOVE_TOKEN', tokenId: 'smoke-host:0' }));
  assert.equal((await moved).state.tokens['smoke-host:0'].position.step, 0);

  const audio = Buffer.alloc(512, 7);
  const upload = await fetch(`${baseUrl}/api/rooms/${roomId}/voice`, {
    method: 'POST',
    headers: {
      'content-type': 'audio/webm',
      'x-room-session': host.authPayload.voiceSessionToken,
      'x-voice-duration': '2',
    },
    body: audio,
  });
  assert.equal(upload.status, 201);
  const uploaded = await upload.json();
  const playback = await fetch(`${baseUrl}/api/rooms/${roomId}/voice/${uploaded.voiceId}`, {
    headers: { 'x-room-session': host.authPayload.voiceSessionToken },
  });
  assert.equal(playback.status, 200);
  assert.equal(Buffer.from(await playback.arrayBuffer()).length, 512);

  const resumeToken = host.authPayload.resumeToken;
  await closeSocket(hostSocket);
  hostSocket = null;
  const resumed = await openRoomSocket(wsUrl, { roomId, resumeToken });
  hostSocket = resumed.socket;
  assert.equal(resumed.snapshot.state.tokens['smoke-host:0'].position.step, 0);
  assert.equal(resumed.snapshot.players.find((entry) => entry.id === 'smoke-host').characterId, 'poison');
  assert.equal(resumed.snapshot.chat.length, 1);

  const health = await fetch(`${baseUrl}/healthz`).then((response) => response.json());
  assert.equal(health.status, 'ok');
  assert.equal(health.voice.files, 1);
  console.log('OPTIMIST LUDO server smoke test: PASS (rooms, character sync, websocket moves, voice upload/playback, reconnect snapshot).');
} finally {
  if (hostSocket) await closeSocket(hostSocket);
  if (playerSocket) await closeSocket(playerSocket);
  await app.close();
}