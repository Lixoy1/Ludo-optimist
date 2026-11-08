const TELEGRAM_API = 'https://api.telegram.org';

function apiUrl(token, method) {
  return `${TELEGRAM_API}/bot${token}/${method}`;
}

async function telegramCall(token, method, payload, fetchImpl = fetch, signal) {
  const response = await fetchImpl(apiUrl(token, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    const error = new Error(result.description || `Telegram API ${method} failed (HTTP ${response.status}).`);
    error.telegramCode = result.error_code || response.status;
    throw error;
  }
  return result.result;
}

export function parseBotCommand(text = '') {
  const match = /^\/(start|help)(?:@[a-zA-Z0-9_]+)?(?:\s|$)/i.exec(String(text).trim());
  return match?.[1].toLowerCase() || null;
}

export function buildStartMessage(webAppUrl) {
  return {
    text: [
      '🎲 <b>OPTIMIST LUDO</b>',
      '',
      'Добро пожаловать! Выбирай доску, персонажа и начинай партию.',
      'Можно играть с ботами или пригласить друзей за один стол.',
      '',
      'Нажми кнопку ниже, чтобы открыть игру прямо в Telegram.',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [[{ text: '🎮 Играть в OPTIMIST LUDO', web_app: { url: webAppUrl } }]],
    },
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startTelegramBot({
  token = process.env.BOT_TOKEN,
  webAppUrl = process.env.WEB_APP_URL || process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim(),
  fetchImpl = fetch,
  logger = console,
} = {}) {
  if (!token) throw new Error('BOT_TOKEN is required to start Telegram bot polling.');
  if (!webAppUrl || !/^https:\/\//i.test(webAppUrl)) {
    throw new Error('WEB_APP_URL or an HTTPS ALLOWED_ORIGINS URL is required for the Telegram Mini App button.');
  }

  let stopped = false;
  let controller = null;
  let offset = 0;

  async function handleUpdate(update) {
    const message = update.message;
    const chatId = message?.chat?.id;
    if (!chatId || message.chat.type !== 'private') return;
    const command = parseBotCommand(message.text);
    if (!command) return;
    const copy = command === 'help'
      ? '🎲 <b>OPTIMIST LUDO</b>\n\nОткрой игру кнопкой ниже. В лобби выбери доску и персонажа, затем запускай партию.'
      : buildStartMessage(webAppUrl).text;
    const payload = command === 'start'
      ? { chat_id: chatId, ...buildStartMessage(webAppUrl) }
      : {
          chat_id: chatId,
          text: copy,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🎮 Играть в OPTIMIST LUDO', web_app: { url: webAppUrl } }]] },
          disable_web_page_preview: true,
        };
    await telegramCall(token, 'sendMessage', payload, fetchImpl);
  }

  async function poll() {
    // Polling requires webhook mode to be disabled; pending updates are preserved.
    await telegramCall(token, 'deleteWebhook', { drop_pending_updates: false }, fetchImpl);
    await telegramCall(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: 'Открыть OPTIMIST LUDO' },
        { command: 'help', description: 'Помощь по игре' },
      ],
    }, fetchImpl);
    await telegramCall(token, 'setChatMenuButton', {
      menu_button: { type: 'web_app', text: 'Играть', web_app: { url: webAppUrl } },
    }, fetchImpl);

    logger.info('[telegram-bot] polling started');
    while (!stopped) {
      controller = new AbortController();
      try {
        const updates = await telegramCall(token, 'getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message'],
        }, fetchImpl, controller.signal);
        for (const update of updates || []) {
          offset = Math.max(offset, Number(update.update_id) + 1);
          try {
            await handleUpdate(update);
          } catch (error) {
            logger.error('[telegram-bot] update failed:', error.message);
          }
        }
      } catch (error) {
        if (stopped || error.name === 'AbortError') break;
        logger.error('[telegram-bot] polling error:', error.message);
        if (error.telegramCode === 409) {
          logger.error('[telegram-bot] another polling process is using this bot token.');
        }
        await wait(3000);
      } finally {
        controller = null;
      }
    }
    logger.info('[telegram-bot] polling stopped');
  }

  const task = poll().catch((error) => logger.error('[telegram-bot] startup failed:', error.message));
  return {
    async stop() {
      stopped = true;
      controller?.abort();
      await task;
    },
  };
}
