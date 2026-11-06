import test from 'node:test';
import assert from 'node:assert/strict';
import { ResumeStore } from '../apps/backend/resume-store.js';

test('resume token is random, room-bound, sliding and can be rotated', () => {
  let now = 100;
  const store = new ResumeStore({ now: () => now, ttlMs: 1000 });
  const issued = store.issue({ userId: 'u1', username: 'Player', roomId: 'room-a' });
  assert.match(issued.token, /^[a-f0-9]{64}$/);
  assert.equal(store.get(issued.token, 'room-b'), null);
  now += 900;
  assert.equal(store.get(issued.token, 'room-a').userId, 'u1');
  now += 900;
  assert.equal(store.get(issued.token, 'room-a').userId, 'u1');
  store.remove(issued.token);
  assert.equal(store.get(issued.token, 'room-a'), null);
});

test('resume tokens expire and session store remains bounded', () => {
  let now = 100;
  const store = new ResumeStore({ now: () => now, ttlMs: 100, maxSessions: 2 });
  const one = store.issue({ userId: 'u1', roomId: 'r' });
  const two = store.issue({ userId: 'u2', roomId: 'r' });
  store.issue({ userId: 'u3', roomId: 'r' });
  assert.equal(store.get(one.token, 'r'), null);
  assert.equal(store.get(two.token, 'r').userId, 'u2');
  now += 101;
  assert.equal(store.get(two.token, 'r'), null);
});