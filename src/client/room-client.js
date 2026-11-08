import { VoiceChatClient, createVoiceMessagePlayer } from './voice-chat.js';

export class LudoRoomClient {
  constructor({ roomId, initData = '', getInitData = null, devUserId = '', devUsername = '', characterId = 'optimist', role = 'PLAYER', wsUrl, onEvent = () => {}, onSnapshot = () => {}, autoReconnect = true } = {}) {
    if (!roomId) throw new TypeError('roomId is required.');
    this.roomId = roomId;
    this.initData = initData;
    this.getInitData = typeof getInitData === 'function' ? getInitData : () => this.initData;
    this.devUserId = devUserId;
    this.devUsername = devUsername;
    this.characterId = characterId;
    this.role = role === 'OBSERVER' ? 'OBSERVER' : 'PLAYER';
    this.wsUrl = wsUrl || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    this.onEvent = onEvent;
    this.onSnapshot = onSnapshot;
    this.autoReconnect = autoReconnect;
    this.socket = null;
    this.voiceSessionToken = null;
    this.resumeToken = null;
    this.voiceClient = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.heartbeatTimer = null;
    this.closedByUser = false;
    this.chatElements = null;
    this.seenMessageIds = new Set();
    this.pendingChatMessages = [];
  }

  static async listRooms({ initData = '', getInitData = null, devUserId = '', devUsername = '', fetchImpl = globalThis.fetch } = {}) {
    const latestInitData = typeof getInitData === 'function' ? getInitData() : initData;
    const headers = {};
    if (latestInitData) headers['x-telegram-init-data'] = latestInitData;
    if (devUserId) { headers['x-dev-user'] = devUserId; headers['x-dev-name'] = devUsername || devUserId; }
    const response = await fetchImpl('/api/rooms', { headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Не удалось загрузить список столов.');
    return data.rooms || [];
  }

  static async createRoom({ initData = '', getInitData = null, devUserId = '', devUsername = '', characterId = 'optimist', maxPlayers = 4, boardType = 'CLASSIC', isPublic = true, fetchImpl = globalThis.fetch } = {}) {
    const normalizedBoardType = String(boardType ?? 'CLASSIC').trim().toUpperCase();
    const limits = {
      CLASSIC: { min:2, max:4 },
      HEXA: { min:6, max:6 },
      ROYAL: { min:4, max:4 },
    }[normalizedBoardType];
    if (!limits) throw new RangeError('Board type must be CLASSIC, HEXA or ROYAL.');
    if (!Number.isInteger(maxPlayers) || maxPlayers < limits.min || maxPlayers > limits.max) {
      throw new RangeError(`${normalizedBoardType} requires ${limits.min === limits.max ? limits.min : `between ${limits.min} and ${limits.max}`} players.`);
    }

    const latestInitData = typeof getInitData === 'function' ? getInitData() : initData;
    const headers = { 'content-type': 'application/json' };
    if (latestInitData) headers['x-telegram-init-data'] = latestInitData;
    if (devUserId) { headers['x-dev-user'] = devUserId; headers['x-dev-name'] = devUsername || devUserId; }
    const response = await fetchImpl('/api/rooms', { method: 'POST', headers, body: JSON.stringify({ maxPlayers, boardType:normalizedBoardType, isPublic, characterId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Не удалось создать игровой стол.');
    return data;
  }

  authMessage() {
    const auth = { type: 'AUTH', roomId: this.roomId, initData: this.getInitData() || '', characterId: this.characterId, role:this.role };
    if (this.resumeToken) auth.resumeToken = this.resumeToken;
    if (this.devUserId) { auth.devUserId = this.devUserId; auth.devUsername = this.devUsername; }
    return auth;
  }

  connect() {
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.wsUrl);
      this.socket = socket;
      let authenticated = false;
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify(this.authMessage()));
      }, { once: true });
      socket.addEventListener('message', (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.event === 'ERROR' && !authenticated) {
          this.closedByUser = true;
          const message = data.payload?.message || data.message || 'Не удалось авторизоваться в комнате.';
          reject(new Error(message));
          socket.close();
          return;
        }
        if (data.event === 'AUTH_OK') {
          authenticated = true;
          this.reconnectAttempt = 0;
          this.voiceSessionToken = data.payload.voiceSessionToken;
          this.resumeToken = data.payload.resumeToken || this.resumeToken;
          this.currentUserId = data.payload.userId;
          this.startHeartbeat();
          this.voiceClient?.destroy();
          this.voiceClient = new VoiceChatClient({
            roomId: this.roomId,
            getSessionToken: () => this.voiceSessionToken,
            onMessage: (message) => this.renderChatMessage(message),
            onStatus: (status) => this.handleVoiceStatus(status),
          });
          if (this.chatElements?.button) this.bindVoiceButton(this.chatElements.button);
          this.onEvent(data);
          resolve(this);
          return;
        }
        if (data.event === 'ROOM_SYNC') {
          this.onSnapshot(data.payload);
          for (const message of data.payload?.chat || []) this.renderChatMessage(message);
        } else if (data.event === 'CHAT_MESSAGE') this.renderChatMessage(data.payload);
        this.onEvent(data);
      });
      socket.addEventListener('error', () => {
        if (!authenticated) reject(new Error('Не удалось подключиться к серверу комнаты.'));
      });
      socket.addEventListener('close', () => {
        this.stopHeartbeat();
        this.voiceSessionToken = null;
        this.voiceClient?.destroy();
        this.voiceClient = null;
        if (!authenticated) reject(new Error('Соединение закрыто до авторизации.'));
        if (!this.closedByUser && this.autoReconnect) this.scheduleReconnect();
        this.onEvent({ event: 'CONNECTION_CLOSED' });
      });
    });
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 60_000);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectAttempt += 1;
    const delay = Math.min(10_000, 500 * (2 ** Math.min(this.reconnectAttempt - 1, 5)));
    this.reconnectTimer = setTimeout(() => {
      if (this.closedByUser) return;
      const socket = new WebSocket(this.wsUrl);
      this.socket = socket;
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify(this.authMessage()));
      }, { once: true });
      let reauthenticated = false;
      socket.addEventListener('message', (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.event === 'ERROR' && !reauthenticated) {
          this.closedByUser = true;
          clearTimeout(this.reconnectTimer);
          this.onEvent(data);
          socket.close();
          return;
        }
        if (data.event === 'AUTH_OK') {
          reauthenticated = true;
          this.reconnectAttempt = 0;
          this.voiceSessionToken = data.payload.voiceSessionToken;
          this.resumeToken = data.payload.resumeToken || this.resumeToken;
          this.currentUserId = data.payload.userId;
          this.startHeartbeat();
          this.voiceClient?.destroy();
          this.voiceClient = new VoiceChatClient({ roomId: this.roomId, getSessionToken: () => this.voiceSessionToken, onMessage: (message) => this.renderChatMessage(message), onStatus: (status) => this.handleVoiceStatus(status) });
          if (this.chatElements?.button) this.bindVoiceButton(this.chatElements.button);
          this.onEvent(data);
        } else if (data.event === 'ROOM_SYNC') {
          this.onSnapshot(data.payload);
          for (const message of data.payload?.chat || []) this.renderChatMessage(message);
        } else if (data.event === 'CHAT_MESSAGE') this.renderChatMessage(data.payload);
        this.onEvent(data);
      });
      socket.addEventListener('close', () => {
        this.stopHeartbeat();
        this.voiceSessionToken = null;
        this.voiceClient?.destroy(); this.voiceClient = null;
        if (!this.closedByUser) this.scheduleReconnect();
      }, { once: true });
    }, delay);
  }

  send(type, payload = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('Нет соединения с игровым столом. Переподключаемся…');
    this.socket.send(JSON.stringify({ type, ...payload }));
  }

  startGame() { this.send('START_GAME'); }
  rollDice() { this.send('ROLL_DICE'); }
  moveToken(tokenId) { this.send('MOVE_TOKEN', { tokenId }); }
  sendChat(text) { this.send('SEND_CHAT', { text }); }
  setCharacter(characterId) { this.characterId = characterId; this.send('SET_CHARACTER', { characterId }); }

  bindVoiceButton(button) {
    this.voiceButtonCleanup?.();
    if (!this.voiceClient || !button) return;
    this.voiceButtonCleanup = this.voiceClient.bindHoldButton(button);
  }

  attachChatUI({ messages, form, input, voiceButton, status } = {}) {
    if (this.chatElements?.form && this.chatSubmit) this.chatElements.form.removeEventListener('submit', this.chatSubmit);
    this.chatElements = { messages, form, input, button: voiceButton, status };
    if (voiceButton && this.voiceClient) this.bindVoiceButton(voiceButton);
    if (this.pendingChatMessages.length) {
      const pending = this.pendingChatMessages.splice(0);
      for (const message of pending) this.appendChatMessage(message);
    }
    if (form && input) {
      this.chatSubmit = (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        try { this.sendChat(text); input.value = ''; } catch (error) { this.onEvent({ event: 'ERROR', payload: { message: error.message } }); }
      };
      form.addEventListener('submit', this.chatSubmit);
    }
  }

  handleVoiceStatus(status) {
    const target = this.chatElements?.status;
    if (target) {
      const labels = {
        'requesting-microphone': 'Запрашиваем доступ к микрофону…', recording: 'Запись идёт. Отпусти кнопку для отправки; смахни влево для отмены.',
        'max-duration': 'Достигнут лимит 30 секунд.', sent: 'Голосовое отправлено.', cancelled: 'Запись отменена.',
      };
      target.textContent = status.message || labels[status.state] || '';
    }
    this.onEvent({ event: 'VOICE_STATUS', payload: status });
  }

  renderChatMessage(message) {
    if (!message?.id || this.seenMessageIds.has(message.id)) return;
    this.seenMessageIds.add(message.id);
    if (this.seenMessageIds.size > 250) this.seenMessageIds.delete(this.seenMessageIds.values().next().value);
    const target = this.chatElements?.messages;
    if (!target || typeof document === 'undefined') { this.pendingChatMessages.push(message); return; }
    this.appendChatMessage(message);
  }

  appendChatMessage(message) {
    const target = this.chatElements?.messages;
    if (!target || typeof document === 'undefined') return;
    const bubble = document.createElement('div');
    bubble.className = 'msg' + (message.senderId === this.currentUserId ? ' mine' : '');
    const author = document.createElement('div'); author.className = 'msg-author'; author.textContent = message.senderType === 'OBSERVER' ? `${message.senderName || 'Гость'} · Наблюдатель` : (message.senderName || 'Игрок');
    bubble.append(author);
    if (message.voice && this.voiceClient) bubble.append(createVoiceMessagePlayer(message, this.voiceClient));
    else { const text = document.createElement('div'); text.textContent = message.text || ''; bubble.append(text); }
    target.append(bubble);
    while (target.children.length > 50) target.firstElementChild?.remove();
    target.scrollTop = target.scrollHeight;
  }

  close() {
    this.closedByUser = true;
    this.stopHeartbeat();
    this.resumeToken = null;
    clearTimeout(this.reconnectTimer);
    this.voiceButtonCleanup?.(); this.voiceButtonCleanup = null;
    this.voiceClient?.destroy(); this.voiceClient = null;
    if (this.chatElements?.form && this.chatSubmit) this.chatElements.form.removeEventListener('submit', this.chatSubmit);
    this.socket?.close(1000, 'Client closed');
  }
}
