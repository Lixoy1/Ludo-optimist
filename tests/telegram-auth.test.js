import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyTelegramInitData } from '../apps/backend/telegram-auth.js';

function sign(botToken, values) {
  const check = [...Object.entries(values)].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const key = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', key).update(check).digest('hex');
  return new URLSearchParams({ ...values, hash }).toString();
}

test('Telegram initData signature and freshness are verified', () => {
  const botToken = '123456:sample-token';
  const nowSeconds = 1_800_000_000;
  const initData = sign(botToken, {
    auth_date: String(nowSeconds - 30),
    user: JSON.stringify({ id: 12345, first_name: 'Player', username: 'optimist' }),
  });
  assert.deepEqual(verifyTelegramInitData(initData, botToken, { nowSeconds }), {
    id: '12345', username: 'optimist', firstName: 'Player',
  });
  assert.throws(() => verifyTelegramInitData(`${initData}x`, botToken, { nowSeconds }), /[Пп]одпись/);
  assert.throws(() => verifyTelegramInitData(initData, botToken, { nowSeconds: nowSeconds + 1000 }), /устарела/);
});