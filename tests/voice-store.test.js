import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceStore } from '../apps/backend/voice-store.js';

const voice = (roomId, length = 300) => ({ roomId, buffer: Buffer.alloc(length, 1), mimeType: 'audio/webm', durationSeconds: 3 });

test('voice cache stores files and isolates them by room', () => {
  const store = new VoiceStore();
  const saved = store.put(voice('room-a'));
  assert.equal(store.get('room-a', saved.id).buffer.length, 300);
  assert.equal(store.get('room-b', saved.id), null);
  assert.equal(store.getStats().files, 1);
});

test('voice cache expires records by TTL', () => {
  let now = 1000;
  const store = new VoiceStore({ now: () => now, limits: { ttlMs: 100 } });
  const saved = store.put(voice('room-a'));
  now = 1200;
  assert.equal(store.get('room-a', saved.id), null);
  assert.equal(store.getStats().bytes, 0);
});

test('voice cache evicts the oldest file when the count limit is reached', () => {
  let now = 1000;
  const store = new VoiceStore({ now: () => now, limits: { maxFiles: 1, maxTotalBytes: 1000 } });
  const first = store.put(voice('room-a'));
  now += 1;
  const second = store.put(voice('room-a'));
  assert.equal(store.get('room-a', first.id), null);
  assert.ok(store.get('room-a', second.id));
});

test('voice cache rejects unknown MIME, invalid duration and oversize payloads', () => {
  const store = new VoiceStore();
  assert.throws(() => store.put({ ...voice('room-a'), mimeType: 'audio/wav' }), /WebM, OGG и MP4/);
  assert.throws(() => store.put({ ...voice('room-a'), durationSeconds: 31 }), /Длительность/);
  assert.throws(() => store.put(voice('room-a', 512 * 1024 + 1)), /слишком большое/);
});