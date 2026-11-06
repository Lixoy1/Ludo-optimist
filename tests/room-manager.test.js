import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../apps/backend/room-manager.js';

const red = { id: 'u-red', username: 'Red' };
const green = { id: 'u-green', username: 'Green' };

test('room host creates table, second player joins and host starts Classic match', () => {
  const manager = new RoomManager({ dice: () => 6 });
  const created = manager.createRoom({ ...red, characterId: 'poison' }, { maxPlayers: 4 });
  assert.equal(created.status, 'lobby');
  manager.joinRoom(created.roomId, { ...green, characterId: 'natalie' });
  assert.equal(created.players[0].characterId, 'poison');
  assert.equal(manager.getSnapshot(created.roomId, red.id).players[1].characterId, 'natalie');
  const started = manager.startGame(created.roomId, red.id);
  assert.equal(started.status, 'playing');
  assert.equal(started.state.players.length, 2);
  assert.equal(started.state.currentPlayer, red.id);
});

test('room actions are server-owned and reject non-members', () => {
  const manager = new RoomManager({ dice: () => 6 });
  const created = manager.createRoom(red);
  manager.joinRoom(created.roomId, green);
  manager.startGame(created.roomId, red.id);
  assert.throws(() => manager.roll(created.roomId, 'intruder'), /не участник/);
  const result = manager.roll(created.roomId, red.id);
  assert.equal(result.state.lastAction.dice, 6);
  assert.equal(result.legalTokenIds.length, 4);
  assert.deepEqual(manager.getSnapshot(created.roomId, red.id).legalTokenIds, result.legalTokenIds);
});

test('room TTL removes inactive rooms', () => {
  let now = 0;
  const manager = new RoomManager({ now: () => now, roomTtlMs: 1000 });
  const created = manager.createRoom(red);
  now = 1100;
  manager.pruneIdleRooms();
  assert.equal(manager.rooms.has(created.roomId), false);
});


test('first chat and voice messages work when the server clock starts at zero', () => {
  let now = 0;
  const manager = new RoomManager({ now: () => now, dice: () => 6 });
  const created = manager.createRoom(red);
  const text = manager.sendChat(created.roomId, red.id, 'Всем привет');
  assert.equal(text.text, 'Всем привет');
  now = 1600;
  const voice = manager.sendVoice(created.roomId, red.id, {
    id: 'a'.repeat(32), durationSeconds: 2, mimeType: 'audio/webm', sizeBytes: 512,
  });
  assert.equal(voice.voice.id, 'a'.repeat(32));
});

test('voice preflight does not mutate the chat timestamp and rate limit is enforced', () => {
  let now = 1000;
  const manager = new RoomManager({ now: () => now });
  const created = manager.createRoom(red);
  assert.equal(manager.assertVoiceAllowed(created.roomId, red.id), true);
  manager.sendChat(created.roomId, red.id, 'Привет');
  assert.throws(() => manager.assertVoiceAllowed(created.roomId, red.id), /Подожди/);
  now += 1500;
  assert.equal(manager.assertVoiceAllowed(created.roomId, red.id), true);
});


test('public room listing prunes expired tables and hides private tables', () => {
  let now = 10_000;
  const manager = new RoomManager({ now: () => now, roomTtlMs: 60_000 });
  const visible = manager.createRoom(red, { isPublic: true });
  manager.createRoom(green, { isPublic: false });
  assert.deepEqual(manager.listPublicRooms().map((room) => room.roomId), [visible.roomId]);
  now += 60_001;
  assert.deepEqual(manager.listPublicRooms(), []);
});


test('players can change character during the room and game without changing their team color', () => {
  const manager = new RoomManager({ dice: () => 6 });
  const created = manager.createRoom({ ...red, characterId: 'optimist' });
  manager.joinRoom(created.roomId, { ...green, characterId: 'lena' });
  manager.startGame(created.roomId, red.id);
  const changed = manager.setCharacter(created.roomId, red.id, 'poison');
  assert.equal(changed.players[0].color, 'red');
  assert.equal(changed.players[0].characterId, 'poison');
  assert.equal(changed.state.players[0].characterId, 'poison');
  assert.throws(() => manager.setCharacter(created.roomId, red.id, 'not-a-character'), /Неизвестный персонаж/);
});