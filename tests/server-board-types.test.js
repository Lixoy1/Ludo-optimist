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

test('HTTP room API creates HEXA and ROYAL rooms with exact board type and capacity', async () => {
  await withServer(async (origin) => {
    const hexaResponse = await createRoom(origin, 'api-hexa-host', 'HEXA', 6);
    assert.equal(hexaResponse.status, 201);
    const hexa = await hexaResponse.json();
    assert.equal(hexa.snapshot.boardType, 'HEXA');
    assert.equal(hexa.snapshot.maxPlayers, 6);
    assert.equal(hexa.snapshot.players.length, 1);

    const royalResponse = await createRoom(origin, 'api-royal-host', 'ROYAL', 4);
    assert.equal(royalResponse.status, 201);
    const royal = await royalResponse.json();
    assert.equal(royal.snapshot.boardType, 'ROYAL');
    assert.equal(royal.snapshot.maxPlayers, 4);
    assert.equal(royal.snapshot.players.length, 1);
  });
});

test('HTTP room API rejects mixed board and seat counts without creating an invalid room', async () => {
  await withServer(async (origin) => {
    const invalid = await createRoom(origin, 'api-invalid-host', 'HEXA', 4);
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
