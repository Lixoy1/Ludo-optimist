import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceChatClient } from '../src/client/voice-chat.js';

test('voice client uploads binary Blob with Durak-compatible headers', async () => {
  let request;
  const client = new VoiceChatClient({
    roomId: '0123456789abcdef',
    getSessionToken: () => 'a'.repeat(64),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ message: { id: 'message-1' } }) };
    },
  });
  const blob = new Blob([new Uint8Array(512)], { type: 'audio/webm' });
  const message = await client.upload(blob, 4);
  assert.equal(message.id, 'message-1');
  assert.equal(request.url, '/api/rooms/0123456789abcdef/voice');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['content-type'], 'audio/webm');
  assert.equal(request.options.headers['x-room-session'], 'a'.repeat(64));
  assert.equal(request.options.headers['x-voice-duration'], '4');
  assert.equal(request.options.body, blob);
});

test('voice client refuses upload when the room session has expired', async () => {
  const client = new VoiceChatClient({ roomId: 'room', getSessionToken: () => null, fetchImpl: async () => { throw new Error('should not fetch'); } });
  await assert.rejects(client.upload(new Blob([new Uint8Array(512)], { type: 'audio/webm' }), 3), /Сессия комнаты потеряна/);
});


test('room client createRoom sends Telegram initData and room limits', async () => {
  const { LudoRoomClient } = await import('../src/client/room-client.js');
  let request;
  const response = await LudoRoomClient.createRoom({
    getInitData: () => 'signed-init-data', maxPlayers: 3, isPublic: false, characterId: 'poison',
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ roomId: '0123456789abcdef' }) }; },
  });
  assert.equal(response.roomId, '0123456789abcdef');
  assert.equal(request.url, '/api/rooms');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['x-telegram-init-data'], 'signed-init-data');
  assert.deepEqual(JSON.parse(request.options.body), { maxPlayers: 3, boardType: 'CLASSIC', isPublic: false, characterId: 'poison' });
});



test('room client accepts HEXA and ROYAL using canonical board IDs', async () => {
  const { LudoRoomClient } = await import('../src/client/room-client.js');
  for (const [boardType, maxPlayers] of [['HEXA', 6], ['ROYAL', 4]]) {
    let payload;
    await LudoRoomClient.createRoom({
      maxPlayers, boardType:boardType.toLowerCase(),
      fetchImpl:async (_url, options) => { payload=JSON.parse(options.body); return { ok:true, json:async()=>({roomId:'board-room'}) }; },
    });
    assert.equal(payload.boardType, boardType);
    assert.equal(payload.maxPlayers, maxPlayers);
  }
});

test('room client rejects unsupported board IDs and impossible player capacities before fetch', async () => {
  const { LudoRoomClient } = await import('../src/client/room-client.js');
  let fetched=false;
  const fetchImpl=async()=>{fetched=true;throw new Error('fetch should not run');};
  for (const boardType of ['UNKNOWN', 'DIAMOND', 'PENTA', 'HEX']) {
    await assert.rejects(
      LudoRoomClient.createRoom({boardType,fetchImpl}),
      /Board type must be CLASSIC, HEXA or ROYAL/,
    );
  }
  for (const [boardType,maxPlayers] of [['CLASSIC',6],['HEXA',4],['ROYAL',6]]) {
    await assert.rejects(
      LudoRoomClient.createRoom({boardType,maxPlayers,fetchImpl}),
      /requires/,
    );
  }
  assert.equal(fetched,false);
});

test('room client listRooms reads the public lobby using Telegram initData', async () => {
  const { LudoRoomClient } = await import('../src/client/room-client.js');
  let request;
  const rooms = await LudoRoomClient.listRooms({
    initData: 'fresh-init-data',
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ rooms: [{ roomId: 'room-1' }] }) }; },
  });
  assert.deepEqual(rooms, [{ roomId: 'room-1' }]);
  assert.equal(request.url, '/api/rooms');
  assert.equal(request.options.headers['x-telegram-init-data'], 'fresh-init-data');
});