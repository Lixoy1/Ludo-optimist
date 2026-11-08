import { LudoRoomClient } from './client/room-client.js';
import { tokenBoardPositions, tokenMovementPath } from './board-render.js';
import { positionFromStepProgress, progressConfigForState } from './game-progress.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacter } from './characters.js';

const $ = (selector) => document.querySelector(selector);
const lobbyView = $('#lobbyView');
const gameView = $('#gameView');
const connectionPill = $('#connectionPill');
const connectionText = $('#connectionText');
const createRoomBtn = $('#createRoomBtn');
const createInviteRoomBtn = $('#createInviteRoomBtn');
const gameControls = document.querySelector('.game-controls');
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
const boardArt = $('#boardArt');
const boardWrap = $('#boardWrap');
const tokenChooser = $('#tokenChooser');
const tokenChooserOptions = $('#tokenChooserOptions');
const tokenChooserClose = $('#tokenChooserClose');
const boardEffectOverlay = $('#boardEffectOverlay');

const CLASSIC_COLOR_ORDER = ['blue', 'red', 'yellow', 'green'];
const PLAYER_COLOR_ORDERS = { HEXA: ['blue', 'red', 'yellow', 'purple', 'green', 'cyan'] };
const COLOR_LABELS = { red: 'КРАСНЫЙ', green: 'ЗЕЛЁНЫЙ', blue: 'СИНИЙ', yellow: 'ЖЁЛТЫЙ', purple: 'ФИОЛЕТОВЫЙ', cyan: 'БИРЮЗОВЫЙ' };
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
const cellHitElements = new Map();
const stackBadgeElements = new Map();
const previousTokenPositions = new Map();
const BOARD_THEMES = ['neon', 'classic'];
let selectedCharacterId = (() => { try { const saved = localStorage.getItem('optimist-ludo-character'); return CHARACTERS.some((item) => item.id === saved) ? saved : DEFAULT_CHARACTER_ID; } catch { return DEFAULT_CHARACTER_ID; } })();
let selectedBoardTheme = (() => { try { const saved = localStorage.getItem('optimist-ludo-board-theme'); return BOARD_THEMES.includes(saved) ? saved : 'neon'; } catch { return 'neon'; } })();
let selectedBoardType = 'CLASSIC';
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

function boardAssetUrl(boardType, theme = selectedBoardTheme) {
  const normalized = String(boardType || 'CLASSIC').toUpperCase();
  const file = normalized === 'CLASSIC'
    ? `optimist-ludo-${theme}.svg`
    : `optimist-ludo-${normalized.toLowerCase()}-${theme}.svg`;
  return new URL(`../assets/boards/${file}`, import.meta.url).href;
}

function updateLobbySelection() {
  document.querySelectorAll('[data-board-choice]').forEach((button) => {
    const active = button.dataset.boardChoice === selectedBoardType;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    const active = button.dataset.themeChoice === selectedBoardTheme;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-classic-count]').forEach((button) => {
    const active = Number(button.dataset.classicCount) === selectedPlayerCount;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const classicPicker = $('#classicCountPicker');
  if (classicPicker) classicPicker.hidden = selectedBoardType !== 'CLASSIC';
  const boardChip = $('#selectedBoardChip');
  if (boardChip) boardChip.textContent = selectedBoardType;
  const count = selectedBoardType === 'HEXA' ? 6 : selectedPlayerCount;
  const title = $('#startSummaryTitle');
  const summary = $('#startSummaryText');
  if (title) title.textContent = `${selectedBoardType} · ${selectedBoardTheme === 'neon' ? 'OPTIMIST' : 'CLASSIC'}`;
  if (summary) summary.textContent = `${count} участника · 1 человек + ${count - 1} бота(ов)`;
}

function selectBoardType(boardType) {
  const normalized = String(boardType || '').toUpperCase();
  if (!['CLASSIC', 'HEXA'].includes(normalized)) return;
  selectedBoardType = normalized;
  selectedPlayerCount = normalized === 'HEXA' ? 6 : 4;
  applyBoardTheme(selectedBoardTheme, selectedBoardType);
  updateLobbySelection();
}

document.querySelectorAll('[data-board-choice]').forEach((button) => {
  button.addEventListener('click', () => selectBoardType(button.dataset.boardChoice));
});
document.querySelectorAll('[data-classic-count]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedPlayerCount = Number(button.dataset.classicCount);
    updateLobbySelection();
  });
});
document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice;
    if (!BOARD_THEMES.includes(theme)) return;
    applyBoardTheme(theme, selectedBoardType);
    updateLobbySelection();
  });
});

function renderCharacterGrid() {
  if (!characterGrid) return;
  const selectedChip = $('#selectedCharacterChip'); if (selectedChip) selectedChip.textContent = getCharacter(selectedCharacterId).name;
  characterGrid.replaceChildren();
  CHARACTERS.forEach((character) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `character-option${character.id === selectedCharacterId ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(character.id === selectedCharacterId));
    button.dataset.fallback = character.name.slice(0, 1).toUpperCase();
    const image = document.createElement('img'); image.src = character.src; image.alt = character.name; image.loading = 'eager'; image.decoding = 'async'; image.draggable = false;
    image.onerror = () => { image.hidden = true; button.classList.add('image-fallback'); };
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

function applyBoardTheme(theme, boardType = selectedBoardType) {
  selectedBoardTheme = BOARD_THEMES.includes(theme) ? theme : 'neon';
  selectedBoardType = ['CLASSIC', 'HEXA'].includes(String(boardType).toUpperCase()) ? String(boardType).toUpperCase() : 'CLASSIC';
  if (boardStage) boardStage.dataset.theme = selectedBoardTheme;
  if (boardWrap) boardWrap.dataset.theme = selectedBoardTheme;
  if (boardArt) {
    const boardFile = selectedBoardType === 'CLASSIC' ? `optimist-ludo-${selectedBoardTheme}.svg` : `optimist-ludo-${selectedBoardType.toLowerCase()}-${selectedBoardTheme}.svg`;
    const nextSrc = boardAssetUrl(selectedBoardType, selectedBoardTheme);
    if (!boardArt.getAttribute('src')?.endsWith(nextSrc)) boardArt.setAttribute('src', nextSrc);
    boardArt.alt = `Игровое поле OPTIMIST LUDO ${selectedBoardType} — ${selectedBoardTheme === 'neon' ? 'OPTIMIST' : 'CLASSIC'}`;
  }
  if (boardThemeSelect) boardThemeSelect.value = selectedBoardTheme;
  document.querySelectorAll('[data-board-preview]').forEach((image) => {
    image.src = boardAssetUrl(image.dataset.boardPreview, selectedBoardTheme);
  });
  updateLobbySelection();
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
  sub.textContent = (room.boardType || 'CLASSIC') + ' · ОТКРЫТЫЙ СТОЛ';
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
  const visual = document.createElement('div');
  visual.className = 'pawn-art';
  visual.dataset.tokenId = tokenId;
  visual.setAttribute('aria-hidden', 'true');
  const halo = document.createElement('span'); halo.className = 'pawn-halo';
  const image = document.createElement('img'); image.className = 'pawn-character'; image.alt = ''; image.draggable = false;
  const colorRing = document.createElement('span'); colorRing.className = 'pawn-color-ring';
  const glint = document.createElement('span'); glint.className = 'pawn-glint';
  visual.append(halo, image, colorRing, glint);
  return visual;
}

function createPawnHitElement(stackKey) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pawn-hit';
  button.dataset.stackKey = stackKey;
  button.setAttribute('aria-label', 'Выбрать фишку на клетке');
  button.addEventListener('click', (event) => {
    if (event.detail === 0) activatePawnCell(button);
  });
  return button;
}

function createStackBadge(stackKey) {
  const badge = document.createElement('span');
  badge.className = 'pawn-overflow-badge';
  badge.dataset.stackKey = stackKey;
  badge.setAttribute('aria-hidden', 'true');
  return badge;
}

function closeTokenChooser() {
  if (!tokenChooser) return;
  tokenChooser.hidden = true;
  tokenChooserOptions?.replaceChildren();
}

function moveSelectedToken(tokenId) {
  closeTokenChooser();
  if (!activeClient || !currentSnapshot?.legalTokenIds?.includes(tokenId)) return;
  try { activeClient.moveToken(tokenId); }
  catch (error) { showToast(error.message); }
}

function activatePawnCell(button) {
  if (!button || button.disabled || !currentSnapshot?.state) return;
  const legalIds = JSON.parse(button.dataset.legalTokenIds || '[]');
  if (legalIds.length === 1) { moveSelectedToken(legalIds[0]); return; }
  if (legalIds.length < 2) return;
  const positions = tokenBoardPositions(currentSnapshot.state);
  const legal = new Set(legalIds);
  tokenChooserOptions.replaceChildren();
  positions.filter((item) => legal.has(item.tokenId)).forEach((item) => {
    const option = document.createElement('button');
    option.type = 'button'; option.className = 'token-choice';
    const image = document.createElement('img'); image.src = getCharacter(item.characterId).src; image.alt = ''; image.draggable = false;
    const copy = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = `ФИШКА ${item.index + 1}`;
    const subtitle = document.createElement('small'); subtitle.textContent = `${COLOR_LABELS[item.color]} · ${item.zone === 'base' ? 'В БАЗЕ' : 'НА ДОРОЖКЕ'}`;
    copy.append(title, subtitle); option.append(image, copy);
    option.addEventListener('click', () => moveSelectedToken(item.tokenId));
    tokenChooserOptions.append(option);
  });
  tokenChooser.hidden = false;
  tokenChooserOptions.querySelector('button')?.focus();
}

function handleBoardPointerUp(event) {
  if (tokenChooser && !tokenChooser.hidden) return;
  if (event.button !== undefined && event.button !== 0) return;
  const rect = boardStage.getBoundingClientRect();
  if (!rect.width) return;
  const legal = [...cellHitElements.values()].filter((button) => !button.disabled);
  let best = null, bestDistance = Infinity;
  for (const button of legal) {
    const x = rect.left + Number(button.dataset.centerX) / 720 * rect.width;
    const y = rect.top + Number(button.dataset.centerY) / 720 * rect.height;
    const distance = Math.hypot(event.clientX - x, event.clientY - y);
    if (distance < bestDistance) { best = button; bestDistance = distance; }
  }
  // Mobile cell artwork is smaller than a finger; map the tap to its nearest legal cell center.
  const radius = Math.max(24, Math.min(30, rect.width / 15 * 1.05));
  if (best && bestDistance <= radius) { event.preventDefault(); activatePawnCell(best); }
}

function colorHex(color) {
  return ({ blue: '#26baff', red: '#ff334f', green: '#55ed39', yellow: '#ffbd24', purple: '#b77aff', orange: '#ff9d38' })[color] || '#e5c06b';
}

function animateToken(element, kind, route = []) {
  if (!kind) return;
  element.classList.remove('moving', 'captured', 'finished-pop');
  void element.offsetWidth;
  element.classList.add(kind);
  if (kind === 'moving' && route.length > 1 && typeof element.animate === 'function') {
    const previousTransition = element.style.transition;
    const finalLeft = element.style.left, finalTop = element.style.top;
    const frames = route.map((point, index) => ({
      left: `${point.x / 720 * 100}%`,
      top: `${point.y / 720 * 100}%`,
      offset: index / (route.length - 1),
    }));
    element.style.transition = 'none';
    const animation = element.animate(frames, {
      duration: Math.max(300, Math.min(1200, (route.length - 1) * 105)),
      easing: 'linear',
      fill: 'none',
    });
    animation.finished.then(() => {
      element.style.transition = previousTransition;
      element.style.left = finalLeft;
      element.style.top = finalTop;
    }).catch(() => {
      element.style.transition = previousTransition;
    });
  }
  setTimeout(() => element.classList.remove(kind), 780);
}

function renderTokens(snapshot) {
  const state = snapshot?.state;
  if (!state?.tokens) {
    for (const element of tokenElements.values()) element.remove();
    for (const element of cellHitElements.values()) element.remove();
    for (const element of stackBadgeElements.values()) element.remove();
    tokenElements.clear(); cellHitElements.clear(); stackBadgeElements.clear(); previousTokenPositions.clear();
    return;
  }
  const positions = tokenBoardPositions(state);
  const legalIds = new Set(snapshot.legalTokenIds || []);
  const activeTurn = snapshot.viewerRole !== 'OBSERVER' && state.currentPlayer === activeClient?.currentUserId;
  const progressConfig = progressConfigForState(state);
  const groups = new Map();
  positions.forEach((position) => {
    const group = groups.get(position.stackKey) || [];
    group.push(position); groups.set(position.stackKey, group);
  });
  const existingIds = new Set(positions.map((position) => position.tokenId));
  for (const [tokenId, element] of tokenElements) if (!existingIds.has(tokenId)) { element.remove(); tokenElements.delete(tokenId); }
  for (const [key, element] of cellHitElements) if (!groups.has(key)) { element.remove(); cellHitElements.delete(key); }
  for (const [key, element] of stackBadgeElements) if (!groups.has(key) || groups.get(key).length <= 2) { element.remove(); stackBadgeElements.delete(key); }

  positions.forEach((position, index) => {
    let element = tokenElements.get(position.tokenId);
    if (!element) { element = createPawnElement(position.tokenId); tokenElements.set(position.tokenId, element); tokenLayer.append(element); }
    const legal = activeTurn && legalIds.has(position.tokenId);
    const ownerIsCurrent = position.owner === state.currentPlayer;
    const old = previousTokenPositions.get(position.tokenId);
    let motion = '';
    if (old && (old.zone !== position.zone || old.left !== position.left || old.top !== position.top)) {
      motion = position.zone === 'base' && old.zone !== 'base' ? ' captured' : position.zone === 'finished' ? ' finished-pop' : ' moving';
    }
    element.className = `pawn-art pawn-${position.color}${legal ? ' legal' : ''}${ownerIsCurrent ? ' current-owner' : ''}${motion}`;
    element.hidden = position.visible === false;
    const character = getCharacter(position.characterId), image = element.querySelector('.pawn-character');
    if (image.dataset.character !== character.id) { image.src = character.src; image.dataset.character = character.id; }
    element.style.setProperty('--token-color', colorHex(position.color));
    element.style.setProperty('--pawn-diameter', `${(position.diameter || 44.64) / 720 * 100}%`);
    element.style.left = `${position.left}%`; element.style.top = `${position.top}%`;
    element.style.setProperty('--pawn-scale', String(position.scale));
    element.style.zIndex = String(4 + index);
    let movementRoute = [];
    const action = state.lastAction;
    if (motion.trim() === 'moving' && action?.type === 'MOVE' && action.tokenId === position.tokenId) {
      const destination = positionFromStepProgress(state.tokens[position.tokenId].stepProgress, progressConfig);
      const path = tokenMovementPath(state, position.owner, action.from, destination, position.index);
      if (path.length) {
        movementRoute = [{ x: old.left * 7.2, y: old.top * 7.2 }, ...path.slice(0, -1), { x: position.x, y: position.y }];
      }
    }
    if (motion) animateToken(element, motion.trim(), movementRoute);
    previousTokenPositions.set(position.tokenId, { zone: position.zone, left: position.left, top: position.top });
  });

  for (const [stackKey, stack] of groups) {
    let hit = cellHitElements.get(stackKey);
    if (!hit) { hit = createPawnHitElement(stackKey); cellHitElements.set(stackKey, hit); tokenLayer.append(hit); }
    const first = stack[0], legalStack = activeTurn ? stack.filter((item) => legalIds.has(item.tokenId)) : [];
    hit.style.left = `${first.centerLeft}%`; hit.style.top = `${first.centerTop}%`;
    hit.dataset.centerX = String(first.centerX); hit.dataset.centerY = String(first.centerY);
    hit.dataset.legalTokenIds = JSON.stringify(legalStack.map((item) => item.tokenId));
    hit.disabled = legalStack.length === 0;
    hit.setAttribute('aria-label', legalStack.length > 1
      ? `Выбрать одну из ${legalStack.length} доступных фишек`
      : legalStack.length === 1 ? `Передвинуть фишку ${legalStack[0].index + 1}` : 'Фишки на клетке');
    if (stack.length > 2) {
      let badge = stackBadgeElements.get(stackKey);
      if (!badge) { badge = createStackBadge(stackKey); stackBadgeElements.set(stackKey, badge); tokenLayer.append(badge); }
      badge.textContent = `×${stack.length}`; badge.style.left = `${first.centerLeft}%`; badge.style.top = `${first.centerTop}%`;
    }
  }
}

function renderPlayers(snapshot) {
  const statePlayers = new Map((snapshot?.state?.players || []).map((player) => [player.id, player]));
  const players = (snapshot?.players || snapshot?.state?.players || []).map((player) => ({ ...statePlayers.get(player.id), ...player }));
  const byColor = new Map(players.map((player) => [player.color, player]));
  playersStrip.replaceChildren();
  const boardType = String(snapshot?.boardType || snapshot?.state?.mode || 'CLASSIC').toUpperCase();
  const colorOrder = PLAYER_COLOR_ORDERS[boardType] || CLASSIC_COLOR_ORDER;
  playersStrip.dataset.playerCount = String(colorOrder.length);
  colorOrder.forEach((color) => {
    const player = byColor.get(color);
    const card = document.createElement('div');
    card.className = `player-card${player && player.id === snapshot?.state?.currentPlayer ? ' current' : ''}${player ? '' : ' empty'}${player?.isBot ? ' bot' : ''}`;
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
    else if (player.isBot) state.textContent = player.id === snapshot?.state?.currentPlayer ? 'БОТ · ХОДИТ' : 'БОТ';
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
  const statePlayer = snapshot?.state?.players?.find((player) => player.id === snapshot?.state?.currentPlayer) || null;
  const roomPlayer = snapshot?.players?.find((player) => player.id === snapshot?.state?.currentPlayer) || null;
  return statePlayer || roomPlayer ? { ...statePlayer, ...roomPlayer } : null;
}

function setDiceFace(value = 5) {
  const face = Number(value);
  const normalized = Number.isInteger(face) && face >= 1 && face <= 6 ? face : 5;
  diceFace.dataset.value = String(normalized);
  diceFace.setAttribute('aria-label', `На кубике ${normalized}`);
}

function renderTurn(snapshot) {
  const state = snapshot?.state;
  gameControls?.classList.toggle('awaiting-start', !state);
  const roster = snapshot?.players || [];
  const me = roster.find((player) => player.id === activeClient?.currentUserId);
  const myColor = me?.color || state?.players?.find((player) => player.id === activeClient?.currentUserId)?.color || 'yellow';
  turnIndicator.style.setProperty('--turn-color', `var(--${myColor})`);
  turnIndicator.textContent = state ? (state.dice ? String(state.dice) : '♛') : '♛';
  turnMeta.textContent = `${roster.length} / ${snapshot?.maxPlayers || 4}`;
  const isObserver = snapshot?.viewerRole === 'OBSERVER';

  if (!state) {
    if (isObserver) {
      turnTitle.textContent = 'РЕЖИМ НАБЛЮДЕНИЯ';
      turnSub.textContent = 'Ожидаем начала партии. Можно общаться в чате.';
      diceStatus.textContent = 'ОЖИДАНИЕ ИГРЫ';
      diceLabel.textContent = 'ПРОСМОТР';
      setDiceFace(5);
      rollDiceBtn.disabled = true;
      startGameBtn.hidden = true;
      moveHint.textContent = 'Ты наблюдатель — начать игру и управлять фишками могут только игроки.';
      return;
    }
    turnTitle.textContent = snapshot?.hostId === activeClient?.currentUserId ? 'Готовы начать?' : 'Ожидание хозяина игры';
    const missingSeats = Math.max(0, (snapshot?.maxPlayers || 4) - roster.length);
    turnSub.textContent = missingSeats ? `${missingSeats} свободных мест займут боты.` : 'Все места заняты. Можно начинать.';
    diceStatus.textContent = 'ЖДЁМ ИГРОКОВ';
    diceLabel.textContent = 'ОЖИДАНИЕ';
    setDiceFace(5);
    rollDiceBtn.disabled = true;
    startGameBtn.hidden = snapshot?.hostId !== activeClient?.currentUserId;
    const readyToStart = roster.some((player) => player.id === activeClient?.currentUserId);
    startGameBtn.disabled = !readyToStart;
    moveHint.textContent = 'Нажми «Начать партию» — пустые места займут боты.';
    return;
  }

  startGameBtn.hidden = true;
  const current = currentPlayerInfo(snapshot);
  if (isObserver && state.phase !== 'finished') {
    turnTitle.textContent = 'РЕЖИМ НАБЛЮДЕНИЯ';
    turnSub.textContent = 'Смотри партию и общайся в общем чате.';
    diceStatus.textContent = state.dice ? `ВЫПАЛО ${state.dice}` : 'ПАРТИЯ ИДЁТ';
    diceLabel.textContent = 'ПРОСМОТР';
    setDiceFace(state.dice || state.lastAction?.dice || 5);
    rollDiceBtn.disabled = true;
    moveHint.textContent = 'Ходы доступны только игрокам. В чате можно писать и отправлять голосовые.';
    return;
  }
  const isMyTurn = !isObserver && state.currentPlayer === activeClient?.currentUserId;
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
    turnSub.textContent = current?.isBot ? 'Соперник делает ход.' : 'Сейчас ход другого игрока.';
    diceStatus.textContent = state.dice ? `ВЫПАЛО ${state.dice}` : 'ХОД СОПЕРНИКА';
    diceLabel.textContent = 'ЖДЁМ';
    moveHint.textContent = current?.isBot ? 'Бот выбирает лучший доступный ход.' : 'Твой ход скоро.';
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
  const boardType = String(snapshot?.boardType || snapshot?.state?.mode || 'CLASSIC').toUpperCase();
  if (boardType !== selectedBoardType) applyBoardTheme(selectedBoardTheme, boardType);
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
  cellHitElements.forEach((element) => element.remove());
  stackBadgeElements.forEach((element) => element.remove());
  tokenElements.clear(); cellHitElements.clear(); stackBadgeElements.clear();
  closeTokenChooser();
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

async function createRoom({ autoStart = true, trigger = createRoomBtn } = {}) {
  trigger.disabled = true;
  const label = trigger.querySelector('span') || trigger;
  const originalLabel = label.textContent;
  label.textContent = autoStart ? 'ЗАПУСКАЕМ…' : 'СОЗДАЁМ…';
  try {
    const result = await LudoRoomClient.createRoom({
      ...authOptions(),
      maxPlayers: selectedPlayerCount,
      boardType: selectedBoardType,
      isPublic: publicRoomToggle.checked,
      characterId: selectedCharacterId,
    });
    await enterRoom(result.roomId);
    if (autoStart && activeClient) activeClient.startGame();
  } catch (error) {
    showToast(error.message || 'Не удалось создать комнату.');
  } finally {
    trigger.disabled = false;
    label.textContent = originalLabel;
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
applyBoardTheme(selectedBoardTheme, selectedBoardType);
updateLobbySelection();
if (tokenLayer) tokenLayer.addEventListener('pointerup', handleBoardPointerUp);
if (tokenChooserClose) tokenChooserClose.addEventListener('click', closeTokenChooser);
if (tokenChooser) tokenChooser.addEventListener('click', (event) => { if (event.target === tokenChooser) closeTokenChooser(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && tokenChooser && !tokenChooser.hidden) closeTokenChooser(); });
if (boardThemeSelect) boardThemeSelect.addEventListener('change', () => applyBoardTheme(boardThemeSelect.value));
if (soundToggleBtn) {
  const updateSoundButton = () => { soundToggleBtn.querySelector('.action-label').textContent = soundEnabled ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ'; soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled)); soundToggleBtn.classList.toggle('sound-off', !soundEnabled); };
  updateSoundButton();
  soundToggleBtn.addEventListener('click', () => { soundEnabled = !soundEnabled; try { localStorage.setItem('optimist-ludo-sound', soundEnabled ? 'on' : 'off'); } catch { /* Optional preference. */ } updateSoundButton(); if (soundEnabled) playGameSound('tap'); });
}

createRoomBtn.addEventListener('click', () => void createRoom({ autoStart: true }));
if (createInviteRoomBtn) createInviteRoomBtn.addEventListener('click', () => void createRoom({ autoStart: false, trigger: createInviteRoomBtn }));
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
