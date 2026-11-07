import test from 'node:test';
import assert from 'node:assert/strict';
import { createLudoServer } from '../apps/backend/server.js';

async function withServer(run) {
  const app = createLudoServer({ allowDevAuth: true, host: '127.0.0.1', port: 0 });
  const address = await app.listen();
  const origin = `http://127.0.0.1:${address.port}`;
  try { await run(origin); }
  finally { await app.close(); }
}

async function createRoom(origin, userId, boardType, maxPlayers) {
  return fetch(origin + '/api/rooms', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dev-user': userId,
      'x-dev-name': userId,
    },
    body: JSON.stringify({ boardType, maxPlayers, isPublic: true, characterId: 'optimist' }),
  });
}

test('HTTP room API creates PENTA and HEX rooms with exact board type and capacity', async () => {
  await withServer(async (origin) => {
    const pentaResponse = await createRoom(origin, 'api-penta-host', 'PENTA', 5);
    assert.equal(pentaResponse.status, 201);
    const penta = await pentaResponse.json();
    assert.equal(penta.snapshot.boardType, 'PENTA');
    assert.equal(penta.snapshot.maxPlayers, 5);
    assert.equal(penta.snapshot.players.length, 1);

    const hexResponse = await createRoom(origin, 'api-hex-host', 'HEX', 6);
    assert.equal(hexResponse.status, 201);
    const hex = await hexResponse.json();
    assert.equal(hex.snapshot.boardType, 'HEX');
    assert.equal(hex.snapshot.maxPlayers, 6);
    assert.equal(hex.snapshot.players.length, 1);
  });
});

test('HTTP room API rejects mixed board and seat counts without creating an invalid room', async () => {
  await withServer(async (origin) => {
    const invalid = await createRoom(origin, 'api-invalid-host', 'PENTA', 4);
    assert.equal(invalid.status, 400);
    const body = await invalid.json();
    assert.equal(body.code, 'INVALID_ROOM_CONFIG');

    const list = await fetch(origin + '/api/rooms', {
      headers: { 'x-dev-user': 'api-list-user', 'x-dev-name': 'ListUser' },
    });
    assert.equal(list.status, 200);
    const data = await list.json();
    assert.equal(data.rooms.some((room) => room.roomId), false);
  });
});

test('HTTP room API continues to accept the four-player Classic capacity', async () => {
  await withServer(async (origin) => {
    const response = await createRoom(origin, 'api-classic-host', 'CLASSIC', 4);
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.snapshot.boardType, 'CLASSIC');
    assert.equal(data.snapshot.maxPlayers, 4);
  });
});
