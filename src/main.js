import { LudoRoomClient } from './client/room-client.js';
import { tokenBoardPositions } from './board-render.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacter } from './characters.js';

const $ = (selector) => document.querySelector(selector);
const lobbyView = $('#lobbyView');
const gameView = $('#gameView');
const connectionPill = $('#connectionPill');
const connectionText = $('#connectionText');
const createRoomBtn = $('#createRoomBtn');
const joinRoomForm = $('#joinRoomForm');
const roomCodeInput = $('#roomCodeInput');
const roomList = $('#roomList');
const refreshRoomsBtn = $('#refreshRoomsBtn');
const publicRoomToggle = $('#publicRoom');
const tokenLayer = $('#tokenLayer');
const playersStrip = $('#playersStrip');
const roomCodeLabel = $('#roomCodeLabel');
const turnTitle = $('#turnTitle');
const turnSub = $('#turnSub');
const turnMeta = $('#turnMeta');
const turnIndicator = $('#turnIndicator');
const turnBanner = $('#turnBanner');
const rollDiceBtn = $('#rollDiceBtn');
const diceFace = $('#diceCube');
const diceLabel = $('#diceLabel');
const diceStatus = $('#diceStatus');
const startGameBtn = $('#startGameBtn');
const moveHint = $('#moveHint');
const chatPanel = $('#chatPanel');
const chatMessages = $('#chatMessages');
const chatForm = $('#chatForm');
const chatInput = $('#chatInput');
const voiceButton = $('#voiceButton');
const voiceStatus = $('#voiceStatus');
const toastEl = $('#toast');
const chatCount = $('#chatCount');
const characterGrid = $('#characterGrid');
const boardThemeSelect = $('#boardThemeSelect');
const soundToggleBtn = $('#soundToggleBtn');
const boardStage = $('#boardStage');
const boardWrap = $('#boardWrap');
const boardEffectOverlay = $('#boardEffectOverlay');

const COLOR_ORDER = ['blue', 'red', 'green', 'yellow'];
const COLOR_LABELS = { red: 'КРАСНЫЙ', green: 'ЗЕЛЁНЫЙ', blue: 'СИНИЙ', yellow: 'ЗОЛОТОЙ' };
const query = new URLSearchParams(location.search);
const telegram = window.Telegram?.WebApp ?? null;
let selectedPlayerCount = 4;
let activeClient = null;
let currentRoomId = null;
let currentSnapshot = null;
let toastTimer = null;
let lobbyRefreshTimer = null;
let rollingAnimationTimer = null;
const tokenElements = new Map();
const previousTokenPositions = new Map();
const BOARD_THEMES = ['neon', 'classic', 'elite', 'marble'];
let selectedCharacterId = (() => { try { const saved = localStorage.getItem('optimist-ludo-character'); return CHARACTERS.some((item) => item.id === saved) ? saved : DEFAULT_CHARACTER_ID; } catch { return DEFAULT_CHARACTER_ID; } })();
let selectedBoardTheme = (() => { try { return localStorage.getItem('optimist-ludo-board-theme') || 'neon'; } catch { return 'neon'; } })();
let soundEnabled = (() => { try { return localStorage.getItem('optimist-ludo-sound') !== 'off'; } catch { return true; } })();
let audioContext = null;
let effectTimer = null;

if (telegram) {
  try { telegram.ready(); telegram.expand(); } catch { /* Telegram shell may omit optional methods. */ }
}

const getInitData = () => telegram?.initData || '';
const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
const devMode = isLocalHost && query.get('dev') !== '0';
let devUserId = '';
let devUsername = '';
if (!getInitData() && devMode) {
  devUserId = query.get('uid') || sessionStorage.getItem('optimist-ludo-dev-id') || `local_${Math.random().toString(36).slice(2, 12)}`;
  devUsername = (query.get('name') || sessionStorage.getItem('optimist-ludo-dev-name') || `Игрок ${devUserId.slice(-4)}`).slice(0, 32);
  sessionStorage.setItem('optimist-ludo-dev-id', devUserId);
  sessionStorage.setItem('optimist-ludo-dev-name', devUsername);
}

function authOptions() {
  return {
    getInitData,
    ...(devUserId ? { devUserId, devUsername } : {}),
  };
}

function showToast(message, duration = 2800) {
  if (!message) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

function setConnection(mode, label) {
  connectionPill.classList.toggle('online', mode === 'online');
  connectionPill.classList.toggle('offline', mode === 'offline');
  connectionText.textContent = label;
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function switchView(view) {
  const showGame = view === 'game';
  lobbyView.hidden = showGame;
  gameView.hidden = !showGame;
  if (showGame) window.scrollTo({ top: 0, behavior: 'auto' });
}

function selectCount(count) {
  selectedPlayerCount = count;
  document.querySelectorAll('[data-count]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.count) === count);
  });
}

document.querySelectorAll('[data-count]').forEach((button) => {
  button.addEventListener('click', () => selectCount(Number(button.dataset.count)));
});

function renderCharacterGrid() {
  if (!characterGrid) return;
  const selectedChip = $('#selectedCharacterChip'); if (selectedChip) selectedChip.textContent = getCharacter(selectedCharacterId).name;
  characterGrid.replaceChildren();
  CHARACTERS.forEach((character) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `character-option${character.id === selectedCharacterId ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(character.id === selectedCharacterId));
    const image = document.createElement('img'); image.src = character.src; image.alt = character.name; image.loading = 'lazy'; image.draggable = false;
    const name = document.createElement('b'); name.textContent = character.name;
    const subtitle = document.createElement('small'); subtitle.textContent = character.subtitle;
    button.append(image, name, subtitle);
    button.addEventListener('click', () => chooseCharacter(character.id));
    characterGrid.append(button);
  });
}

function chooseCharacter(characterId) {
  if (!CHARACTERS.some((item) => item.id === characterId)) return;
  selectedCharacterId = characterId;
  try { localStorage.setItem('optimist-ludo-character', characterId); } catch { /* Storage may be disabled in private webviews. */ }
  renderCharacterGrid();
  const chip = $('#selectedCharacterChip'); if (chip) chip.textContent = getCharacter(characterId).name;
  if (activeClient) {
    try { activeClient.setCharacter(characterId); showToast(`${getCharacter(characterId).name} выбран персонажем за столом.`); }
    catch (error) { showToast(error.message); }
  }
}

function applyBoardTheme(theme) {
  selectedBoardTheme = BOARD_THEMES.includes(theme) ? theme : 'neon';
  if (boardStage) boardStage.dataset.theme = selectedBoardTheme;
  if (boardWrap) boardWrap.dataset.theme = selectedBoardTheme;
  if (boardThemeSelect) boardThemeSelect.value = selectedBoardTheme;
  try { localStorage.setItem('optimist-ludo-board-theme', selectedBoardTheme); } catch { /* Optional preference. */ }
}

function playGameSound(type = 'tap') {
  if (!soundEnabled) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    audioContext ||= new AudioCtx();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const now = audioContext.currentTime;
    const notes = type === 'capture' ? [220, 165] : type === 'finish' ? [660, 880, 1100] : type === 'roll' ? [320, 420, 520] : type === 'six' ? [660, 880] : [440, 620];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type === 'capture' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.065);
      gain.gain.setValueAtTime(0.0001, now + index * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.07, now + index * 0.065 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.065 + 0.16);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(now + index * 0.065); oscillator.stop(now + index * 0.065 + 0.17);
    });
  } catch { /* Audio is an optional cosmetic feature. */ }
}

function showBoardEffect(title, subtitle = '', kind = 'move') {
  if (!boardEffectOverlay) return;
  boardEffectOverlay.replaceChildren();
  const card = document.createElement('div'); card.className = `board-effect-card effect-${kind}`;
  const titleNode = document.createElement('b'); titleNode.textContent = title;
  card.append(titleNode);
  if (subtitle) { const sub = document.createElement('small'); sub.textContent = subtitle; card.append(sub); }
  boardEffectOverlay.append(card);
  clearTimeout(effectTimer);
  effectTimer = setTimeout(() => card.remove(), 1650);
}

function playActionFeedback(snapshot, previous) {
  const action = snapshot?.state?.lastAction;
  const previousRevision = previous?.state?.revision ?? -1;
  if (!action || snapshot.state.revision === previousRevision) return;
  if (action.type === 'ROLL') {
    playGameSound(action.dice === 6 ? 'six' : 'roll');
    if (action.skipped) showBoardEffect('ТРИ ШЕСТЁРКИ!', 'Ход переходит дальше', 'capture');
    else if (action.dice === 6) showBoardEffect('ШЕСТЁРКА!', 'Дополнительный бросок', 'six');
    return;
  }
  if (action.type === 'MOVE') {
    if (action.captured?.length) { playGameSound('capture'); showBoardEffect('ВЫБИВАНИЕ!', 'Чужая фишка возвращается в базу', 'capture'); }
    else if (action.to?.zone === 'finished') { playGameSound('finish'); showBoardEffect('ФИНИШ!', 'Фишка дома', 'finish'); }
    else if (action.from?.zone === 'base') { playGameSound('six'); showBoardEffect('В ИГРУ!', 'Фишка вышла на дорожку', 'launch'); }
    else { playGameSound('move'); if (action.bonusRoll) showBoardEffect('ЕЩЁ ХОД!', 'Удача на твоей стороне', 'six'); }
  }
}

function roomCard(room) {
  const card = document.createElement('div');
  card.className = 'room-item';
  const info = document.createElement('div');
  info.className = 'room-item-info';
  const title = document.createElement('b');
  title.textContent = `СТОЛ ${room.roomId.slice(0, 4).toUpperCase()} · ${room.players}/${room.maxPlayers}`;
  const sub = document.createElement('small');
  sub.textContent = 'CLASSIC · ОТКРЫТЫЙ СТОЛ';
  info.append(title, sub);
  const join = document.createElement('button');
  join.type = 'button';
  join.textContent = 'ВОЙТИ';
  join.addEventListener('click', () => void enterRoom(room.roomId));
  card.append(info, join);
  return card;
}

async function refreshRooms() {
  try {
    const rooms = await LudoRoomClient.listRooms(authOptions());
    roomList.replaceChildren();
    if (!rooms.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-rooms';
      empty.textContent = 'Пока нет открытых столов. Создай свой и пригласи друзей.';
      roomList.append(empty);
      return;
    }
    rooms.forEach((room) => roomList.append(roomCard(room)));
  } catch (error) {
    roomList.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'empty-rooms';
    empty.textContent = error.message || 'Не удалось загрузить столы.';
    roomList.append(empty);
  }
}

function createPawnElement(tokenId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pawn';
  button.dataset.tokenId = tokenId;
  const halo = document.createElement('span'); halo.className = 'pawn-halo';
  const image = document.createElement('img'); image.className = 'pawn-character'; image.alt = ''; image.draggable = false;
  const colorRing = document.createElement('span'); colorRing.className = 'pawn-color-ring';
  const glint = document.createElement('span'); glint.className = 'pawn-glint';
  button.append(halo, image, colorRing, glint);
  button.addEventListener('click', () => {
    if (!activeClient || !currentSnapshot?.legalTokenIds?.includes(tokenId)) return;
    try { activeClient.moveToken(tokenId); }
    catch (error) { showToast(error.message); }
  });
  return button;
}

function colorHex(color) {
  return ({ blue: '#26baff', red: '#ff334f', green: '#55ed39', yellow: '#ffbd24' })[color] || '#e5c06b';
}

function animateToken(element, kind) {
  if (!kind) return;
  element.classList.remove('moving', 'captured', 'finished-pop');
  void element.offsetWidth;
  element.classList.add(kind);
  setTimeout(() => element.classList.remove(kind), 780);
}

function renderTokens(snapshot) {
  const state = snapshot?.state;
  if (!state?.tokens) {
    for (const element of tokenElements.values()) element.remove();
    tokenElements.clear();
    previousTokenPositions.clear();
    return;
  }
  const positions = tokenBoardPositions(state);
  const legalIds = new Set(snapshot.legalTokenIds || []);
  const existingIds = new Set(positions.map((position) => position.tokenId));

  for (const [tokenId, element] of tokenElements) {
    if (!existingIds.has(tokenId)) { element.remove(); tokenElements.delete(tokenId); }
  }

  positions.forEach((position, index) => {
    let element = tokenElements.get(position.tokenId);
    if (!element) {
      element = createPawnElement(position.tokenId);
      tokenElements.set(position.tokenId, element);
      tokenLayer.append(element);
    }
    const legal = legalIds.has(position.tokenId) && state.currentPlayer === activeClient?.currentUserId;
    const ownerIsCurrent = position.owner === state.currentPlayer;
    const oldPosition = previousTokenPositions.get(position.tokenId);
    let motion = '';
    if (oldPosition && (oldPosition.zone !== position.zone || oldPosition.left !== position.left || oldPosition.top !== position.top)) {
      motion = position.zone === 'base' && oldPosition.zone !== 'base' ? ' captured' : position.zone === 'finished' ? ' finished-pop' : ' moving';
    }
    element.className = `pawn pawn-${position.color}${legal ? ' legal' : ''}${ownerIsCurrent ? ' current-owner' : ''}${motion}`;
    const character = getCharacter(position.characterId);
    const image = element.querySelector('.pawn-character');
    if (image.dataset.character !== character.id) { image.src = character.src; image.dataset.character = character.id; }
    element.style.setProperty('--token-color', colorHex(position.color));
    if (motion) animateToken(element, motion.trim());
    element.style.left = `${position.left}%`;
    element.style.top = `${position.top}%`;
    element.style.setProperty('--pawn-scale', String(position.scale));
    element.style.zIndex = String(4 + index);
    element.disabled = !legal;
    element.title = `${COLOR_LABELS[position.color]} · фишка ${position.index + 1}${legal ? ' · нажми, чтобы походить' : ''}`;
    element.setAttribute('aria-label', element.title);
    previousTokenPositions.set(position.tokenId, { zone: position.zone, left: position.left, top: position.top });
  });
}

function renderPlayers(snapshot) {
  const players = snapshot?.state?.players || snapshot?.players || [];
  const byColor = new Map(players.map((player) => [player.color, player]));
  playersStrip.replaceChildren();
  COLOR_ORDER.forEach((color) => {
    const player = byColor.get(color);
    const card = document.createElement('div');
    card.className = `player-card${player && player.id === snapshot?.state?.currentPlayer ? ' current' : ''}${player ? '' : ' empty'}`;
    card.style.setProperty('--player-color', `var(--${color})`);
    const avatar = document.createElement('img');
    avatar.className = 'player-character-avatar';
    avatar.alt = ''; avatar.draggable = false; avatar.hidden = !player; avatar.src = getCharacter(player?.characterId || DEFAULT_CHARACTER_ID).src;
    card.append(avatar);
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player ? (player.username || player.id) : COLOR_LABELS[color];
    const state = document.createElement('span');
    state.className = 'player-state';
    if (!player) state.textContent = 'СВОБОДНО';
    else if (player.status === 'finished') state.textContent = 'ФИНИШ';
    else if (player.id === snapshot?.state?.currentPlayer) state.textContent = 'ХОДИТ';
    else state.textContent = 'В ИГРЕ';
    const dots = document.createElement('span');
    dots.className = 'mini-pawns';
    for (let i = 0; i < 4; i += 1) {
      const dot = document.createElement('i');
      dots.append(dot);
    }
    card.append(name, state, dots);
    playersStrip.append(card);
  });
}

function currentPlayerInfo(snapshot) {
  const roster = snapshot?.state?.players || snapshot?.players || [];
  return roster.find((player) => player.id === snapshot?.state?.currentPlayer) || null;
}

function setDiceFace(value = 5) {
  const face = Number(value);
  const normalized = Number.isInteger(face) && face >= 1 && face <= 6 ? face : 5;
  diceFace.dataset.value = String(normalized);
  diceFace.setAttribute('aria-label', `На кубике ${normalized}`);
}

function renderTurn(snapshot) {
  const state = snapshot?.state;
  const roster = snapshot?.players || [];
  const me = roster.find((player) => player.id === activeClient?.currentUserId);
  const myColor = me?.color || state?.players?.find((player) => player.id === activeClient?.currentUserId)?.color || 'yellow';
  turnIndicator.style.setProperty('--turn-color', `var(--${myColor})`);
  turnIndicator.textContent = state ? (state.dice ? String(state.dice) : '♛') : '♛';
  turnMeta.textContent = `${roster.length} / ${snapshot?.maxPlayers || 4}`;

  if (!state) {
    turnTitle.textContent = snapshot?.hostId === activeClient?.currentUserId ? 'Ты создал этот стол' : 'Стол открыт';
    turnSub.textContent = roster.length < 2 ? 'Пригласи друга по коду комнаты — вдвоём веселее.' : 'Все готовы? Хозяин стола может начинать.';
    diceStatus.textContent = 'ЖДЁМ ИГРОКОВ';
    diceLabel.textContent = 'ОЖИДАНИЕ';
    setDiceFace(5);
    rollDiceBtn.disabled = true;
    startGameBtn.hidden = snapshot?.hostId !== activeClient?.currentUserId;
    startGameBtn.disabled = roster.length < 2;
    moveHint.textContent = roster.length < 2 ? 'Отправь другу ссылку или код комнаты.' : 'Все фишки появятся на поле после старта партии.';
    return;
  }

  startGameBtn.hidden = true;
  const current = currentPlayerInfo(snapshot);
  const isMyTurn = state.currentPlayer === activeClient?.currentUserId;
  const canRoll = isMyTurn && state.dice === null && state.phase === 'playing';
  const canMove = isMyTurn && state.dice !== null && (snapshot.legalTokenIds || []).length > 0;

  if (state.phase === 'finished') {
    const winner = state.players.find((player) => player.id === state.winner);
    turnTitle.textContent = `ПОБЕДА: ${winner?.username || 'игрок'}!`;
    turnSub.textContent = 'Четыре фишки в центре. Красиво сыграно!';
    diceStatus.textContent = 'ПАРТИЯ ЗАВЕРШЕНА';
    diceLabel.textContent = 'ФИНИШ';
    rollDiceBtn.disabled = true;
    moveHint.textContent = 'Новая партия появится отдельным столом из лобби.';
    return;
  }

  if (isMyTurn && canMove) {
    turnTitle.textContent = 'Твой ход — выбери фишку';
    turnSub.textContent = `Выпало ${state.dice}. Подсвечены допустимые ходы.`;
    diceStatus.textContent = 'ВЫПАЛО';
    diceLabel.textContent = 'ВЫБЕРИ ФИШКУ';
    moveHint.textContent = 'Нажми на одну из подсвеченных фишек на поле.';
  } else if (isMyTurn && canRoll) {
    turnTitle.textContent = 'Твой ход — бросай кубик';
    turnSub.textContent = 'Шестёрка выводит фишку из базы. Удачи!';
    diceStatus.textContent = 'ТВОЙ БРОСОК';
    diceLabel.textContent = 'БРОСИТЬ';
    moveHint.textContent = 'Кубик бросается на сервере. Клиент не может подменить результат.';
  } else {
    turnTitle.textContent = `Ход: ${current?.username || 'игрок'}`;
    turnSub.textContent = 'Следим за партией. Твой ход скоро.';
    diceStatus.textContent = state.dice ? `ВЫПАЛО ${state.dice}` : 'ХОД СОПЕРНИКА';
    diceLabel.textContent = 'ЖДЁМ';
    moveHint.textContent = 'Фишки соперника двигаются синхронно со всеми игроками.';
  }
  setDiceFace(state.dice || state.lastAction?.dice || 5);
  rollDiceBtn.disabled = !canRoll;
  if (canRoll) diceButtonReset();
}

function diceButtonReset() {
  clearTimeout(rollingAnimationTimer);
  rollDiceBtn.classList.remove('rolling');
  rollDiceBtn.disabled = false;
}

function renderSnapshot(snapshot) {
  const previous = currentSnapshot;
  playActionFeedback(snapshot, previous);
  currentSnapshot = snapshot;
  renderPlayers(snapshot);
  renderTokens(snapshot);
  renderTurn(snapshot);
  roomCodeLabel.textContent = snapshot.roomId || currentRoomId || '————————';
  const count = snapshot.chat?.length || 0;
  chatCount.textContent = String(count);
  chatCount.hidden = count === 0;
  if (chatPanel.hidden && count > 0) {
    // The chat button remains discreet; users can open it when they choose.
  }
}

function openChat() {
  chatPanel.hidden = false;
  $('#chatToggleBtn').classList.add('active');
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatInput.focus({ preventScroll: true });
}
function closeChat() {
  chatPanel.hidden = true;
  $('#chatToggleBtn').classList.remove('active');
}

function attachChat() {
  if (!activeClient) return;
  activeClient.attachChatUI({
    messages: chatMessages,
    form: chatForm,
    input: chatInput,
    voiceButton,
    status: voiceStatus,
  });
  if (!chatMessages.children.length) {
    const empty = document.createElement('div');
    empty.className = 'chat-empty';
    empty.textContent = 'Здесь будут сообщения игроков за столом.';
    chatMessages.append(empty);
  }
}

async function enterRoom(roomId) {
  if (!/^[a-f0-9]{16}$/.test(String(roomId || ''))) {
    showToast('Код комнаты должен состоять из 16 символов.');
    return;
  }
  if (activeClient) { activeClient.close(); activeClient = null; }
  currentRoomId = roomId;
  currentSnapshot = null;
  tokenElements.forEach((element) => element.remove());
  tokenElements.clear();
  previousTokenPositions.clear();
  chatMessages.replaceChildren();
  closeChat();
  switchView('game');
  setConnection('offline', 'ПОДКЛЮЧАЕМСЯ');
  turnTitle.textContent = 'Подключаемся к столу…';
  turnSub.textContent = 'Синхронизируем комнату и состояние игры.';
  const resumeToken = sessionStorage.getItem(`optimist-ludo-resume:${roomId}`) || '';
  const client = new LudoRoomClient({
    roomId,
    ...authOptions(),
    characterId: selectedCharacterId,
    onSnapshot: renderSnapshot,
    onEvent: (event) => {
      if (event.event === 'AUTH_OK') {
        if (event.payload?.resumeToken) sessionStorage.setItem(`optimist-ludo-resume:${roomId}`, event.payload.resumeToken);
        setConnection('online', 'ЗА СТОЛОМ');
      } else if (event.event === 'CONNECTION_CLOSED') {
        setConnection('offline', 'ВОССТАНАВЛИВАЕМ');
        voiceStatus.textContent = 'Связь потеряна. Пытаемся восстановить комнату…';
      } else if (event.event === 'ROLL_RESULT') {
        const value = event.payload?.dice;
        if (value >= 1 && value <= 6) setDiceFace(value);
        if (value === 6) showBoardEffect('ШЕСТЁРКА!', 'Бросай ещё раз после хода', 'six');
        rollDiceBtn.classList.remove('rolling');
        if (event.payload?.skipped) showToast('Три шестёрки подряд — ход пропущен.');
        else if (event.payload?.bonusRoll) showToast('Дополнительный бросок!');
      } else if (event.event === 'CHAT_MESSAGE') {
        const nextCount = Number(chatCount.textContent || 0) + 1;
        chatCount.textContent = String(nextCount);
        chatCount.hidden = false;
        if (chatMessages.querySelector('.chat-empty')) chatMessages.querySelector('.chat-empty').remove();
      } else if (event.event === 'ERROR') {
        const message = event.payload?.message || event.message || 'Не удалось выполнить действие.';
        showToast(message);
      }
    },
  });
  client.resumeToken = resumeToken || null;
  activeClient = client;
  try {
    await client.connect();
    attachChat();
    setConnection('online', 'ЗА СТОЛОМ');
  } catch (error) {
    activeClient = null;
    client.close();
    switchView('lobby');
    setConnection('offline', getInitData() ? 'НЕТ СВЯЗИ' : 'НУЖЕН TELEGRAM');
    showToast(error.message || 'Не удалось войти в комнату.');
    await refreshRooms();
  }
}

async function createRoom() {
  createRoomBtn.disabled = true;
  createRoomBtn.querySelector('span').textContent = 'СОЗДАЁМ СТОЛ…';
  try {
    const result = await LudoRoomClient.createRoom({
      ...authOptions(),
      maxPlayers: selectedPlayerCount,
      isPublic: publicRoomToggle.checked,
      characterId: selectedCharacterId,
    });
    await enterRoom(result.roomId);
  } catch (error) {
    showToast(error.message || 'Не удалось создать комнату.');
  } finally {
    createRoomBtn.disabled = false;
    createRoomBtn.querySelector('span').textContent = 'СОЗДАТЬ ИГРУ';
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано. Отправь приглашение другу!');
  } catch {
    showToast(text, 5000);
  }
}

renderCharacterGrid();
applyBoardTheme(selectedBoardTheme);
if (boardThemeSelect) boardThemeSelect.addEventListener('change', () => applyBoardTheme(boardThemeSelect.value));
if (soundToggleBtn) {
  const updateSoundButton = () => { soundToggleBtn.querySelector('.action-label').textContent = soundEnabled ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ'; soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled)); soundToggleBtn.classList.toggle('sound-off', !soundEnabled); };
  updateSoundButton();
  soundToggleBtn.addEventListener('click', () => { soundEnabled = !soundEnabled; try { localStorage.setItem('optimist-ludo-sound', soundEnabled ? 'on' : 'off'); } catch { /* Optional preference. */ } updateSoundButton(); if (soundEnabled) playGameSound('tap'); });
}

createRoomBtn.addEventListener('click', () => void createRoom());
joinRoomForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const roomId = roomCodeInput.value.trim().toLowerCase();
  void enterRoom(roomId);
});
refreshRoomsBtn.addEventListener('click', () => void refreshRooms());

startGameBtn.addEventListener('click', () => {
  if (!activeClient) return;
  try { activeClient.startGame(); }
  catch (error) { showToast(error.message); }
});

rollDiceBtn.addEventListener('click', () => {
  if (!activeClient || rollDiceBtn.disabled) return;
  rollDiceBtn.disabled = true;
  rollDiceBtn.classList.add('rolling');
  playGameSound('roll');
  setDiceFace(5);
  diceLabel.textContent = 'БРОСОК…';
  try { activeClient.rollDice(); }
  catch (error) {
    rollDiceBtn.classList.remove('rolling');
    rollDiceBtn.disabled = false;
    showToast(error.message);
  }
  clearTimeout(rollingAnimationTimer);
  rollingAnimationTimer = setTimeout(() => rollDiceBtn.classList.remove('rolling'), 800);
});

$('#leaveRoomBtn').addEventListener('click', () => {
  activeClient?.close();
  activeClient = null;
  currentRoomId = null;
  currentSnapshot = null;
  switchView('lobby');
  setConnection('online', getInitData() ? 'TELEGRAM' : 'LOCAL DEV');
  closeChat();
  void refreshRooms();
});
$('#copyInviteBtn').addEventListener('click', () => {
  if (!currentRoomId) return;
  const url = new URL(location.href);
  url.search = `?room=${currentRoomId}`;
  void copyText(url.toString());
});
$('#copyCodeBtn').addEventListener('click', () => { if (currentRoomId) void copyText(currentRoomId); });
$('#chatToggleBtn').addEventListener('click', () => chatPanel.hidden ? openChat() : closeChat());
$('#closeChatBtn').addEventListener('click', closeChat);

window.addEventListener('pagehide', () => activeClient?.close());

if (!getInitData() && !devMode) {
  setConnection('offline', 'ОТКРОЙ В TELEGRAM');
  showToast('Открой OPTIMIST LUDO внутри Telegram, чтобы войти за игровой стол.', 4500);
} else {
  setConnection('online', devMode && !getInitData() ? 'LOCAL DEV' : 'TELEGRAM');
}

void refreshRooms();
lobbyRefreshTimer = setInterval(() => {
  if (!gameView.hidden) return;
  void refreshRooms();
}, 12_000);

const deepLinkRoom = query.get('room');
if (deepLinkRoom) {
  roomCodeInput.value = deepLinkRoom;
  void enterRoom(deepLinkRoom.toLowerCase());
}
