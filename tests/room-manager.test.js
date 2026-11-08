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
  assert.equal(started.state.players.length, 4);
  assert.equal(started.players.filter((player) => player.isBot).length, 2);
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
  const originalColor = created.players[0].color;
  const changed = manager.setCharacter(created.roomId, red.id, 'poison');
  assert.equal(changed.players[0].color, originalColor);
  assert.equal(changed.players[0].characterId, 'poison');
  assert.equal(changed.state.players[0].characterId, 'poison');
  assert.throws(() => manager.setCharacter(created.roomId, red.id, 'not-a-character'), /Неизвестный персонаж/);
});

for (const [boardType, maxPlayers] of [['HEXA',6]]) {
  test(boardType + ' starts with one human and fills every missing seat with a bot', () => {
    const manager = new RoomManager({ dice: () => 1 });
    const host = { id: boardType.toLowerCase() + '-0', username: 'Host' };
    const created = manager.createRoom(host, { boardType, maxPlayers });
    assert.equal(created.boardType, boardType);
    assert.equal(created.maxPlayers, maxPlayers);
    assert.equal(created.players.length, 1);
    const started = manager.startGame(created.roomId, host.id);
    assert.equal(started.status, 'playing');
    assert.equal(started.state.mode, boardType);
    assert.equal(started.state.trackLength, boardType === 'HEXA' ? 72 : 68);
    assert.equal(started.state.players.length, maxPlayers);
    assert.equal(started.players.filter((player) => player.isBot).length, maxPlayers - 1);
    assert.equal(new Set(started.players.map((player) => player.color)).size, maxPlayers);
    assert.equal(started.state.currentPlayer, host.id);
    assert.equal(manager.getSnapshot(created.roomId, host.id).boardType, boardType);
  });
}

test('extended room types reject invalid capacities and public room list identifies their board', () => {
  const manager = new RoomManager();
  assert.throws(() => manager.createRoom({ id:'bad-hexa', username:'Bad' }, { boardType:'HEXA', maxPlayers:4 }), /HEXA/);
  assert.throws(() => manager.createRoom({ id:'bad-royal', username:'Bad' }, { boardType:'ROYAL', maxPlayers:4 }), /Неизвестный тип доски/);
  const created = manager.createRoom({ id:'hexa-list', username:'Hexa' }, { boardType:'HEXA', maxPlayers:6 });
  assert.equal(created.boardType, 'HEXA');
  const room = manager.listPublicRooms().find((item) => item.roomId === created.roomId);
  assert.equal(room.boardType, 'HEXA');
});


test('a one-human Classic game starts immediately with three bots that take complete legal turns', () => {
  const dice = [6, 1, 6, 1, 6, 1, 6, 1];
  let cursor = 0;
  const manager = new RoomManager({ dice: () => dice[cursor++ % dice.length] });
  const created = manager.createRoom(red, { maxPlayers: 4 });
  const started = manager.startGame(created.roomId, red.id);
  assert.equal(started.status, 'playing');
  assert.equal(started.players.filter((player) => player.isBot).length, 3);

  const firstRoll = manager.roll(created.roomId, red.id);
  assert.equal(firstRoll.state.dice, 6);
  manager.move(created.roomId, red.id, 'u-red:0');
  const secondRoll = manager.roll(created.roomId, red.id);
  assert.equal(secondRoll.state.dice, 1);
  manager.move(created.roomId, red.id, 'u-red:0');

  const snapshot = manager.getSnapshot(created.roomId, red.id);
  assert.equal(snapshot.state.currentPlayer, red.id);
  for (const bot of snapshot.players.filter((player) => player.isBot)) {
    const movedToken = Object.values(snapshot.state.tokens).find((token) => token.owner === bot.id && token.stepProgress === 1);
    assert.ok(movedToken, `${bot.username} should release a pawn and move it one legal cell`);
  }
});

test('Classic player capacity may be filled partly by humans and partly by bots', () => {
  const manager = new RoomManager({ dice: () => 1 });
  const created = manager.createRoom(red, { maxPlayers: 4 });
  manager.joinRoom(created.roomId, green);
  const started = manager.startGame(created.roomId, red.id);
  assert.equal(started.players.filter((player) => player.isBot).length, 2);
  assert.deepEqual(started.players.slice(0,2).map((player) => player.id), [red.id, green.id]);
});


for (const [boardType, maxPlayers] of [['HEXA',6]]) {
  test(boardType + ' bots roll, release a pawn and complete a legal track move before returning the turn to the human', () => {
    let rollIndex = 0;
    const manager = new RoomManager({ dice: () => ([6, 1][rollIndex++ % 2]) });
    const human = { id: boardType.toLowerCase() + '-human', username: 'Human' };
    const created = manager.createRoom(human, { boardType, maxPlayers });
    manager.startGame(created.roomId, human.id);

    const humanRoll = manager.roll(created.roomId, human.id);
    assert.equal(humanRoll.state.dice, 6);
    manager.move(created.roomId, human.id, human.id + ':0');
    const bonusRoll = manager.roll(created.roomId, human.id);
    assert.equal(bonusRoll.state.dice, 1);
    manager.move(created.roomId, human.id, human.id + ':0');

    const snapshot = manager.getSnapshot(created.roomId, human.id);
    assert.equal(snapshot.state.currentPlayer, human.id);
    const bots = snapshot.players.filter((player) => player.isBot);
    assert.equal(bots.length, maxPlayers - 1);
    for (const bot of bots) {
      assert.ok(Object.values(snapshot.state.tokens).some((token) =>
        token.owner === bot.id && token.stepProgress === 1
      ), `${boardType} bot ${bot.username} should release and move a pawn`);
    }
  });
}

test('server-controlled bots cannot authenticate as real room members', () => {
  const manager = new RoomManager({ dice: () => 1 });
  const created = manager.createRoom(red, { maxPlayers: 4 });
  const started = manager.startGame(created.roomId, red.id);
  const bot = started.players.find((player) => player.isBot);
  assert.ok(bot);
  assert.equal(manager.isMember(created.roomId, bot.id), false);
  assert.throws(() => manager.getSnapshot(created.roomId, bot.id), /Нет доступа/);
  assert.throws(() => manager.roll(created.roomId, bot.id), /не участник/);
});

test('observers can read the game and use text and voice chat but cannot control the match', () => {
  let now=10_000;
  const manager = new RoomManager({ now:()=>now, dice:()=>6 });
  const created = manager.createRoom(red, { maxPlayers:2 });
  manager.startGame(created.roomId, red.id);
  const observer = { id:'guest-observer', username:'Guest Observer' };
  const joined = manager.joinAsObserver(created.roomId, observer);
  assert.equal(joined.viewerRole,'OBSERVER');
  assert.equal(joined.observerCount,1);
  assert.deepEqual(joined.observers.map((item)=>item.id),[observer.id]);
  assert.equal(manager.isMember(created.roomId,observer.id),false);
  assert.equal(manager.isObserver(created.roomId,observer.id),true);
  assert.equal(manager.getRole(created.roomId,observer.id),'OBSERVER');
  assert.equal(manager.getSnapshot(created.roomId,observer.id).state.phase,'playing');

  const textMessage=manager.sendChat(created.roomId,observer.id,'Привет, я смотрю игру');
  assert.equal(textMessage.senderType,'OBSERVER');
  assert.equal(textMessage.senderName,observer.username);
  assert.equal(textMessage.text,'Привет, я смотрю игру');

  now+=1600;
  assert.equal(manager.assertVoiceAllowed(created.roomId,observer.id),true);
  const voiceMessage=manager.sendVoice(created.roomId,observer.id,{
    id:'b'.repeat(32),durationSeconds:3,mimeType:'audio/webm',sizeBytes:512,
  });
  assert.equal(voiceMessage.senderType,'OBSERVER');
  assert.equal(voiceMessage.voice.id,'b'.repeat(32));
  assert.equal(manager.getSnapshot(created.roomId,observer.id).chat.length,2);

  assert.throws(()=>manager.roll(created.roomId,observer.id),/не участник/);
  assert.throws(()=>manager.move(created.roomId,observer.id,red.id+':0'),/не участник/);
  assert.throws(()=>manager.setCharacter(created.roomId,observer.id,'poison'),/не участник/);
  assert.throws(()=>manager.joinRoom(created.roomId,observer),/уже началась/);
});

test('an observer can rejoin without duplicating their chat identity', () => {
  const manager=new RoomManager();
  const created=manager.createRoom(red,{maxPlayers:2});
  const observer={id:'same-observer',username:'Observer'};
  manager.joinAsObserver(created.roomId,observer);
  manager.joinAsObserver(created.roomId,observer);
  const snapshot=manager.getSnapshot(created.roomId,observer.id);
  assert.equal(snapshot.observerCount,1);
  assert.equal(snapshot.observers.length,1);
  assert.equal(snapshot.viewerRole,'OBSERVER');
});

test('an observer in the lobby can take an open player seat before the game starts', () => {
  const manager = new RoomManager({ dice:()=>1 });
  const created = manager.createRoom(red,{maxPlayers:4});
  const observer={id:'waiting-guest',username:'Waiting Guest'};
  const observation=manager.joinAsObserver(created.roomId,observer);
  assert.equal(observation.viewerRole,'OBSERVER');
  assert.equal(observation.observerCount,1);
  const promoted=manager.joinRoom(created.roomId,observer);
  assert.equal(promoted.viewerRole,'PLAYER');
  assert.equal(promoted.players.some((player)=>player.id===observer.id),true);
  assert.equal(promoted.observerCount,0);
  assert.equal(manager.isMember(created.roomId,observer.id),true);
  assert.equal(manager.isObserver(created.roomId,observer.id),false);
});

test('observers cannot claim bot identities or exceed the per-room observer limit', () => {
  const manager = new RoomManager({maxRooms:2,dice:()=>1});
  const created=manager.createRoom(red,{maxPlayers:2});
  manager.startGame(created.roomId,red.id);
  const bot=manager.getSnapshot(created.roomId,red.id).players.find((player)=>player.isBot);
  assert.throws(()=>manager.joinAsObserver(created.roomId,{id:bot.id,username:'Fake bot'}),/боту/);
  for(let index=0;index<100;index++) {
    manager.joinAsObserver(created.roomId,{id:'observer-'+index,username:'Observer '+index});
  }
  assert.throws(()=>manager.joinAsObserver(created.roomId,{id:'observer-overflow',username:'Too many'}),/слишком много наблюдателей/);
});
