import { randomBytes } from 'node:crypto';

export const DEFAULT_VOICE_LIMITS = Object.freeze({
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 8 * 1024 * 1024,
  maxFiles: 40,
  ttlMs: 6 * 60 * 60 * 1000,
  maxDurationSeconds: 30,
  minDurationSeconds: 1,
  minFileBytes: 256,
});

export class VoiceStoreError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'VoiceStoreError'; this.code = code; this.status = status; }
}

export class VoiceStore {
  constructor({ now = Date.now, limits = {} } = {}) {
    this.now = now;
    this.limits = { ...DEFAULT_VOICE_LIMITS, ...limits };
    this.files = new Map();
    this.totalBytes = 0;
  }

  prune() {
    const cutoff = this.now() - this.limits.ttlMs;
    for (const [id, file] of this.files) if (file.createdAt <= cutoff) this.remove(id);
  }

  remove(id) {
    const file = this.files.get(id);
    if (!file) return false;
    this.totalBytes = Math.max(0, this.totalBytes - file.buffer.length);
    this.files.delete(id);
    return true;
  }

  put({ roomId, buffer, mimeType, durationSeconds }) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Voice buffer must be a Buffer.');
    const { maxFileBytes, maxTotalBytes, maxFiles, minFileBytes, minDurationSeconds, maxDurationSeconds } = this.limits;
    if (!['audio/webm', 'audio/ogg', 'audio/mp4'].includes(mimeType)) throw new VoiceStoreError('UNSUPPORTED_MEDIA_TYPE', 'Поддерживаются WebM, OGG и MP4.');
    if (!Number.isInteger(durationSeconds) || durationSeconds < minDurationSeconds || durationSeconds > maxDurationSeconds) {
      throw new VoiceStoreError('INVALID_VOICE_DURATION', `Длительность записи должна быть от ${minDurationSeconds} до ${maxDurationSeconds} секунд.`);
    }
    if (buffer.length < minFileBytes) throw new VoiceStoreError('EMPTY_VOICE_MESSAGE', 'Запись слишком короткая или пустая.');
    if (buffer.length > maxFileBytes) throw new VoiceStoreError('PAYLOAD_TOO_LARGE', 'Голосовое сообщение слишком большое.');
    if (buffer.length > maxTotalBytes) throw new VoiceStoreError('VOICE_STORAGE_FULL', 'Запись превышает свободный лимит временного хранилища.', 503);

    this.prune();
    while (this.files.size >= maxFiles || this.totalBytes + buffer.length > maxTotalBytes) {
      const oldestId = this.files.keys().next().value;
      if (!oldestId) break;
      this.remove(oldestId);
    }
    if (this.totalBytes + buffer.length > maxTotalBytes) throw new VoiceStoreError('VOICE_STORAGE_FULL', 'Временное хранилище голосовых заполнено.', 503);
    const id = randomBytes(16).toString('hex');
    const record = { id, roomId, mimeType, buffer: Buffer.from(buffer), durationSeconds, createdAt: this.now() };
    this.files.set(id, record);
    this.totalBytes += record.buffer.length;
    return { id, roomId, mimeType, sizeBytes: record.buffer.length, durationSeconds, createdAt: record.createdAt };
  }

  get(roomId, id) {
    this.prune();
    const file = this.files.get(id);
    if (!file || file.roomId !== roomId) return null;
    return { ...file, buffer: Buffer.from(file.buffer) };
  }

  getStats() { this.prune(); return { files: this.files.size, bytes: this.totalBytes, maxFiles: this.limits.maxFiles, maxBytes: this.limits.maxTotalBytes }; }
}
