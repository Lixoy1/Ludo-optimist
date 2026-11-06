import { randomBytes } from 'node:crypto';

export class ResumeStore {
  constructor({ now = Date.now, ttlMs = 24 * 60 * 60 * 1000, maxSessions = 200 } = {}) {
    if (typeof now !== 'function') throw new TypeError('now must be a function.');
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('ttlMs must be positive.');
    if (!Number.isInteger(maxSessions) || maxSessions < 1) throw new RangeError('maxSessions must be positive.');
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
    this.sessions = new Map();
  }

  issue({ userId, username, roomId }) {
    if (typeof userId !== 'string' || !userId || typeof roomId !== 'string' || !roomId) {
      throw new TypeError('A userId and roomId are required to issue a resume token.');
    }
    this.prune();
    while (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (!oldest) break;
      this.sessions.delete(oldest);
    }
    const token = randomBytes(32).toString('hex');
    const session = { userId, username: String(username || userId).slice(0, 40), roomId, expiresAt: this.now() + this.ttlMs };
    this.sessions.set(token, session);
    return { token, ...session };
  }

  get(token, roomId) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(token);
      return null;
    }
    if (session.roomId !== roomId) return null;
    session.expiresAt = this.now() + this.ttlMs;
    return { ...session };
  }

  remove(token) { return this.sessions.delete(token); }

  prune() {
    const now = this.now();
    for (const [token, session] of this.sessions) if (session.expiresAt <= now) this.sessions.delete(token);
  }

  getStats() { this.prune(); return { sessions: this.sessions.size, maxSessions: this.maxSessions }; }
}
