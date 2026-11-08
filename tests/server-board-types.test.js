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

test('HTTP room API creates the two supported boards with exact seat capacities', async () => {
  await withServer(async (origin) => {
    const hexaResponse = await createRoom(origin, 'api-hexa-host', 'HEXA', 6);
    assert.equal(hexaResponse.status, 201);
    const hexa = await hexaResponse.json();
    assert.equal(hexa.snapshot.boardType, 'HEXA');
    assert.equal(hexa.snapshot.maxPlayers, 6);
    assert.equal(hexa.snapshot.players.length, 1);

    const classicResponse = await createRoom(origin, 'api-classic-host', 'CLASSIC', 4);
    assert.equal(classicResponse.status, 201);
    const classic = await classicResponse.json();
    assert.equal(classic.snapshot.boardType, 'CLASSIC');
    assert.equal(classic.snapshot.maxPlayers, 4);
    assert.equal(classic.snapshot.players.length, 1);
  });
});

test('HTTP room API rejects invalid capacities and the retired experimental board', async () => {
  await withServer(async (origin) => {
    const invalidCapacity = await createRoom(origin, 'api-invalid-host', 'HEXA', 4);
    assert.equal(invalidCapacity.status, 400);
    assert.equal((await invalidCapacity.json()).code, 'INVALID_ROOM_CONFIG');

    const retired = await createRoom(origin, 'api-retired-host', 'ROYAL', 4);
    assert.equal(retired.status, 400);
    assert.equal((await retired.json()).code, 'INVALID_ROOM_CONFIG');

    const list = await fetch(origin + '/api/rooms', {
      headers: { 'x-dev-user': 'api-list-user', 'x-dev-name': 'ListUser' },
    });
    assert.equal(list.status, 200);
    const data = await list.json();
    assert.equal(data.rooms.some((room) => room.roomId), false);
  });
});
