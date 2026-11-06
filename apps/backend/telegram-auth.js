import { createHmac, timingSafeEqual } from 'node:crypto';

export class AuthError extends Error {
  constructor(code, message, status = 401) { super(message); this.name = 'AuthError'; this.code = code; this.status = status; }
}

export function verifyTelegramInitData(initData, botToken, {
  nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = 600, futureSkewSeconds = 30,
} = {}) {
  if (!botToken || !botToken.includes(':')) throw new AuthError('SERVER_CONFIG', 'BOT_TOKEN не настроен.', 500);
  if (typeof initData !== 'string' || !initData || initData.length > 16_384) {
    throw new AuthError('INVALID_INIT_DATA', 'Данные Telegram отсутствуют или слишком велики.');
  }
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || params.getAll('hash').length !== 1) {
    throw new AuthError('INVALID_HASH', 'Подпись Telegram отсутствует или имеет неверный формат.');
  }
  params.delete('hash');
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(checkString).digest();
  const supplied = Buffer.from(hash, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AuthError('INVALID_SIGNATURE', 'Не удалось проверить подпись Telegram.');
  }

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw || !/^\d+$/.test(authDateRaw)) throw new AuthError('INVALID_AUTH_DATE', 'Не указана дата авторизации Telegram.');
  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + futureSkewSeconds || nowSeconds - authDate > maxAgeSeconds) {
    throw new AuthError('EXPIRED_INIT_DATA', 'Сессия Telegram устарела. Открой Mini App заново.');
  }

  const userRaw = params.get('user');
  if (!userRaw || userRaw.length > 4_096) throw new AuthError('MISSING_USER', 'В данных Telegram нет пользователя.');
  let parsed;
  try { parsed = JSON.parse(userRaw); } catch { throw new AuthError('INVALID_USER', 'Профиль Telegram повреждён.'); }
  if (!parsed || typeof parsed !== 'object') throw new AuthError('INVALID_USER', 'Профиль Telegram повреждён.');
  const rawId = parsed.id;
  if (!(typeof rawId === 'number' && Number.isSafeInteger(rawId) && rawId > 0) && !(typeof rawId === 'string' && /^\d+$/.test(rawId))) {
    throw new AuthError('INVALID_USER_ID', 'Telegram user ID имеет неверный формат.');
  }
  const firstName = typeof parsed.first_name === 'string' ? parsed.first_name.trim().slice(0, 64) : '';
  const username = typeof parsed.username === 'string' ? parsed.username.trim().slice(0, 64) : firstName;
  return { id: String(rawId), username: username || `Player_${rawId}`, firstName: firstName || 'Игрок' };
}

export function authenticateHttpRequest(req, { botToken, allowDevAuth = false } = {}) {
  if (allowDevAuth && process.env.NODE_ENV !== 'production') {
    const devId = req.headers['x-dev-user'];
    if (typeof devId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(devId)) {
      const name = typeof req.headers['x-dev-name'] === 'string' ? req.headers['x-dev-name'].slice(0, 40) : devId;
      return { id: devId, username: name, firstName: name };
    }
  }
  const initData = req.headers['x-telegram-init-data'];
  if (typeof initData !== 'string') throw new AuthError('MISSING_INIT_DATA', 'Открой игру внутри Telegram.');
  return verifyTelegramInitData(initData, botToken);
}
