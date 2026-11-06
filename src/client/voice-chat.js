const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

export class VoiceChatClient {
  constructor({ roomId, getSessionToken, onMessage = () => {}, onStatus = () => {}, fetchImpl = globalThis.fetch, mediaDevices = globalThis.navigator?.mediaDevices, MediaRecorderClass = globalThis.MediaRecorder, maxDurationMs = 30_000, maxBytes = 512 * 1024 } = {}) {
    if (!roomId || typeof getSessionToken !== 'function') throw new TypeError('roomId and getSessionToken are required.');
    this.roomId = roomId;
    this.getSessionToken = getSessionToken;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.fetch = fetchImpl;
    this.mediaDevices = mediaDevices;
    this.MediaRecorderClass = MediaRecorderClass;
    this.maxDurationMs = maxDurationMs;
    this.maxBytes = maxBytes;
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
    this.stopTimer = null;
    this.cancelRequested = false;
    this.activeAudio = null;
    this.activeAudioMessageId = null;
    this.activeAudioUrl = null;
    this.objectUrls = new Set();
    this.boundButton = null;
    this.destroyed = false;
  }

  async startRecording() {
    if (this.destroyed) throw new Error('Клиент голосовых сообщений закрыт.');
    if (this.recorder) throw new Error('Запись уже идёт.');
    if (!this.mediaDevices?.getUserMedia || typeof this.MediaRecorderClass !== 'function') {
      throw new Error('Запись звука не поддерживается этим браузером. Открой игру в актуальном Telegram.');
    }
    if (!this.getSessionToken()) throw new Error('Нет активной сессии комнаты. Переподключись к игре.');
    this.onStatus({ state: 'requesting-microphone' });
    this.stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.destroyed) { this.releaseStream(); throw new Error('Запись отменена.'); }
    const mimeType = MIME_PREFERENCE.find((candidate) => this.MediaRecorderClass.isTypeSupported?.(candidate));
    try {
      this.recorder = new this.MediaRecorderClass(this.stream, { audioBitsPerSecond: 32_000, ...(mimeType ? { mimeType } : {}) });
    } catch (error) {
      this.releaseStream();
      this.recorder = null;
      throw error;
    }
    this.chunks = [];
    this.cancelRequested = false;
    this.startedAt = Date.now();
    this.recorder.addEventListener('dataavailable', (event) => { if (event.data?.size) this.chunks.push(event.data); });
    this.recorder.addEventListener('error', () => this.onStatus({ state: 'error', message: 'Не удалось записать звук.' }));
    this.recorder.start(250);
    this.stopTimer = setTimeout(() => {
      this.onStatus({ state: 'max-duration' });
      this.setButtonRecording(false);
      void this.stopRecording();
    }, this.maxDurationMs);
    this.onStatus({ state: 'recording', startedAt: this.startedAt, maxDurationMs: this.maxDurationMs });
  }

  async stopRecording({ cancel = false } = {}) {
    const recorder = this.recorder;
    if (!recorder) return null;
    this.cancelRequested = Boolean(cancel);
    clearTimeout(this.stopTimer);
    this.stopTimer = null;
    if (recorder.state === 'inactive') {
      this.recorder = null;
      this.releaseStream();
      return null;
    }
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener('stop', async () => {
        const elapsedMs = Date.now() - this.startedAt;
        const mimeType = (recorder.mimeType || this.chunks[0]?.type || 'audio/webm').split(';')[0].toLowerCase();
        const blob = new Blob(this.chunks, { type: mimeType });
        this.recorder = null;
        this.releaseStream();
        this.chunks = [];
        this.setButtonRecording(false);
        if (this.cancelRequested) {
          this.onStatus({ state: 'cancelled' });
          resolve(null);
          return;
        }
        if (elapsedMs < 800 || blob.size < 256) {
          this.onStatus({ state: 'error', message: 'Запиши хотя бы одну секунду.' });
          resolve(null);
          return;
        }
        if (blob.size > this.maxBytes) {
          this.onStatus({ state: 'error', message: 'Запись превышает 512 КиБ. Попробуй говорить короче.' });
          resolve(null);
          return;
        }
        try {
          const message = await this.upload(blob, Math.min(30, Math.ceil(elapsedMs / 1000)));
          this.onMessage(message);
          this.onStatus({ state: 'sent', message });
          resolve(message);
        } catch (error) {
          this.onStatus({ state: 'error', message: error.message });
          reject(error);
        }
      }, { once: true });
    });
    recorder.stop();
    return stopped;
  }

  cancelRecording() { return this.stopRecording({ cancel: true }); }

  setButtonRecording(recording) {
    if (!this.boundButton) return;
    this.boundButton.classList.toggle('recording', recording);
    this.boundButton.textContent = recording ? 'Отпустите — отправить' : '🎙️';
  }

  releaseStream() {
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null;
  }

  async upload(blob, durationSeconds) {
    const token = this.getSessionToken();
    if (!token) throw new Error('Сессия комнаты потеряна. Переподключись и повтори отправку.');
    const mimeType = (blob.type || 'audio/webm').split(';')[0].toLowerCase();
    const response = await this.fetch(`/api/rooms/${encodeURIComponent(this.roomId)}/voice`, {
      method: 'POST',
      headers: { 'content-type': mimeType, 'x-room-session': token, 'x-voice-duration': String(durationSeconds) },
      body: blob,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Не удалось отправить голосовое сообщение.');
    return data.message;
  }

  async play(message) {
    const voice = message?.voice;
    if (!voice || !/^[a-f0-9]{32}$/.test(voice.id || '')) throw new Error('Некорректная ссылка на голосовое сообщение.');
    const token = this.getSessionToken();
    if (!token) throw new Error('Сессия комнаты потеряна. Переподключись к игре.');
    if (this.activeAudio && this.activeAudioMessageId === voice.id && !this.activeAudio.ended) {
      if (this.activeAudio.paused) await this.activeAudio.play();
      else this.activeAudio.pause();
      return this.activeAudio;
    }
    this.releaseActiveAudio();
    const response = await this.fetch(`/api/rooms/${encodeURIComponent(this.roomId)}/voice/${encodeURIComponent(voice.id)}`, { headers: { 'x-room-session': token } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Голосовое сообщение уже недоступно.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    this.objectUrls.add(objectUrl);
    const audio = new Audio(objectUrl);
    this.activeAudio = audio;
    this.activeAudioMessageId = voice.id;
    this.activeAudioUrl = objectUrl;
    const cleanup = () => {
      if (this.activeAudio === audio) this.releaseActiveAudio();
      else this.releaseObjectUrl(objectUrl);
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    await audio.play();
    return audio;
  }

  releaseActiveAudio() {
    const audio = this.activeAudio;
    const url = this.activeAudioUrl;
    this.activeAudio = null;
    this.activeAudioMessageId = null;
    this.activeAudioUrl = null;
    audio?.pause();
    if (url) this.releaseObjectUrl(url);
  }

  releaseObjectUrl(url) {
    if (!this.objectUrls.has(url)) return;
    URL.revokeObjectURL(url);
    this.objectUrls.delete(url);
  }

  bindHoldButton(button) {
    if (!button) throw new TypeError('A voice button element is required.');
    let pointerId = null;
    let pendingEnd = null;
    let startX = 0;
    this.boundButton = button;
    const start = async (event) => {
      if (pointerId !== null) return;
      event.preventDefault();
      const activePointer = event.pointerId;
      startX = event.clientX;
      pointerId = activePointer;
      pendingEnd = null;
      button.setPointerCapture?.(activePointer);
      this.setButtonRecording(true);
      try {
        await this.startRecording();
        // The user may release/cancel while the microphone permission prompt is open.
        if (pointerId !== activePointer) {
          if (pendingEnd === 'cancel') await this.cancelRecording();
          else await this.stopRecording();
        }
      } catch (error) {
        pointerId = null;
        button.classList.remove('recording');
        button.textContent = '🎙️';
        this.onStatus({ state: 'error', message: error.message });
      }
    };
    const stop = async (event) => {
      if (pointerId === null || (event.pointerId !== undefined && event.pointerId !== pointerId)) return;
      event.preventDefault(); pointerId = null; pendingEnd = 'send';
      this.setButtonRecording(false);
      if (this.recorder) { try { await this.stopRecording(); } catch { /* onStatus receives the user-facing error. */ } }
    };
    const cancel = (event) => {
      if (pointerId === null || (event.pointerId !== undefined && event.pointerId !== pointerId)) return;
      pointerId = null; pendingEnd = 'cancel'; this.setButtonRecording(false);
      if (this.recorder) void this.cancelRecording();
    };
    const move = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      if (startX - event.clientX > 80) cancel(event);
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', cancel);
    button.addEventListener('lostpointercapture', cancel);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    return () => {
      button.removeEventListener('pointerdown', start);
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', stop);
      button.removeEventListener('pointercancel', cancel);
      button.removeEventListener('lostpointercapture', cancel);
      void this.cancelRecording();
      if (this.boundButton === button) this.boundButton = null;
    };
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.stopTimer);
    if (this.recorder?.state !== 'inactive') void this.stopRecording({ cancel: true });
    this.releaseStream();
    this.releaseActiveAudio();
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls.clear();
  }
}


export function createVoiceMessagePlayer(message, voiceClient) {
  const wrapper = document.createElement('div');
  wrapper.className = 'voice-player';
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'voice-play'; button.textContent = '▶';
  button.setAttribute('aria-label', 'Воспроизвести голосовое сообщение');
  const track = document.createElement('div');
  track.className = 'voice-track'; track.setAttribute('role', 'slider'); track.setAttribute('aria-label', 'Позиция голосового сообщения');
  const progress = document.createElement('div'); progress.className = 'voice-progress'; track.append(progress);
  const duration = document.createElement('span');
  duration.className = 'voice-duration'; duration.textContent = `${message.voice?.durationSeconds ?? 0} сек.`;
  let audio = null;
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const update = () => {
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    progress.style.width = `${Math.max(0, Math.min(100, audio.currentTime / audio.duration * 100))}%`;
    duration.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  };
  button.addEventListener('click', async () => {
    button.disabled = true; button.textContent = '…';
    try {
      audio = await voiceClient.play(message);
      if (audio.__optimistPlayer !== wrapper) {
        audio.addEventListener('timeupdate', update);
        audio.addEventListener('play', () => { button.textContent = 'Ⅱ'; button.setAttribute('aria-label', 'Приостановить голосовое сообщение'); });
        audio.addEventListener('pause', () => { button.textContent = '▶'; button.setAttribute('aria-label', 'Продолжить голосовое сообщение'); });
        audio.addEventListener('ended', () => { progress.style.width = '0%'; duration.textContent = `${message.voice.durationSeconds} сек.`; button.textContent = '▶'; });
        audio.__optimistPlayer = wrapper;
      }
      button.textContent = audio.paused ? '▶' : 'Ⅱ';
      update();
    } catch (error) { button.textContent = '↻'; duration.textContent = error.message; }
    finally { button.disabled = false; }
  });
  track.addEventListener('click', (event) => {
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const bounds = track.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * audio.duration;
    update();
  });
  wrapper.append(button, track, duration);
  return wrapper;
}
