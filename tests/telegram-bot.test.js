import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStartMessage, parseBotCommand, startTelegramBot } from '../apps/backend/telegram-bot.js';

test('Telegram bot recognizes start/help commands including bot mentions', () => {
  assert.equal(parseBotCommand('/start'), 'start');
  assert.equal(parseBotCommand('/start@OptimistLudoBot hello'), 'start');
  assert.equal(parseBotCommand('/HELP'), 'help');
  assert.equal(parseBotCommand('hello'), null);
  assert.equal(parseBotCommand('/settings'), null);
});

test('start message contains a Telegram Web App launch button', () => {
  const message = buildStartMessage('https://ludo-optimist.onrender.com');
  assert.match(message.text, /OPTIMIST LUDO/);
  assert.deepEqual(message.reply_markup.inline_keyboard[0][0].web_app, {
    url: 'https://ludo-optimist.onrender.com',
  });
});

test('polling answers /start and preserves pending updates when disabling webhook', async () => {
  const calls = [];
  let updatesReturned = false;
  let resolveSent;
  const sent = new Promise((resolve) => { resolveSent = resolve; });
  const fetchImpl = async (url, options = {}) => {
    const method = url.split('/').pop();
    const body = options.body ? JSON.parse(options.body) : {};
    calls.push({ method, body });
    if (method === 'getUpdates' && !updatesReturned) {
      updatesReturned = true;
      return { ok: true, json: async () => ({ ok: true, result: [{
        update_id: 7,
        message: { chat: { id: 123, type: 'private' }, text: '/start' },
      }] }) };
    }
    if (method === 'sendMessage') resolveSent(body);
    if (method === 'getUpdates') {
      return await new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
        }, { once: true });
      });
    }
    return { ok: true, json: async () => ({ ok: true, result: true }) };
  };
  const bot = startTelegramBot({
    token: '123456:test-token',
    webAppUrl: 'https://ludo-optimist.onrender.com',
    fetchImpl,
    logger: { info() {}, error(message) { throw new Error(String(message)); } },
  });
  const sentMessage = await Promise.race([
    sent,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Bot did not answer /start')), 2000)),
  ]);
  assert.equal(sentMessage.chat_id, 123);
  assert.equal(sentMessage.reply_markup.inline_keyboard[0][0].web_app.url, 'https://ludo-optimist.onrender.com');
  assert.deepEqual(calls[0], { method: 'deleteWebhook', body: { drop_pending_updates: false } });
  assert.ok(calls.some((call) => call.method === 'setMyCommands'));
  assert.ok(calls.some((call) => call.method === 'setChatMenuButton'));
  await bot.stop();
});
