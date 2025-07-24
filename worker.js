const TELEGRAM_TOKEN = '8085303818:AAE1G-ekS5pWFqdTIR0eibXCMoWYNs77RaU';
const CHANNEL_USERNAME = '@your_channel_4';
const PARTNER_LINK = 'https://partner.service.com/register?sub1=';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- POSTBACK: Регистрация ---
    if (url.pathname === '/postback/registration' && request.method === 'POST') {
      const data = await request.json();
      await env.DB.prepare(
        `INSERT INTO Registrations ("User ID", "Telegram ID", "DateTime", "Country", "Source", "Hash", "Hash ID", "Event ID")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.user_id, data.sub1, data.date, data.country, data.source_id, data.hash_name, data.hash_id, data.event_id
      ).run();
      // Сообщение о регистрации и просьба сделать депозит
      await sendMessage(data.sub1, 'Регистрация прошла успешно! Теперь сделайте депозит.');
      return new Response('OK');
    }

    // --- POSTBACK: Депозит ---
    if (url.pathname === '/postback/deposit' && request.method === 'POST') {
      const data = await request.json();
      await env.DB.prepare(
        `INSERT INTO Deposits ("User ID", "Telegram ID", "DateTime", "Amount", "Transaction ID", "Source", "Hash", "Hash ID", "Country", "Event ID")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.user_id, data.sub1, data.date, data.amount, data.transaction_id, data.source_id, data.hash_name, data.hash_id, data.country, data.event_id
      ).run();
      // Сообщение о попадании в главное меню
      await sendMessage(data.sub1, 'Депозит успешно зачислен! Вы попали в главное меню.');
      return new Response('OK');
    }

    // --- TELEGRAM WEBHOOK ---
    if (request.method === 'POST') {
      const update = await request.json();
      if (!update.message && !update.callback_query) return new Response('No message', { status: 200 });

      // Обработка callback-кнопки "Проверить подписку"
      if (update.callback_query) {
        const chatId = update.callback_query.from.id;
        const isMember = await checkSubscription(chatId);
        if (!isMember) {
          await answerCallback(update.callback_query.id, 'Пожалуйста, подпишитесь на канал!');
        } else {
          await answerCallback(update.callback_query.id, 'Подписка подтверждена!');
          await handleUserFlow(chatId, env);
        }
        return new Response('OK');
      }

      // Обычное сообщение
      const chatId = update.message.chat.id;
      await handleUserFlow(chatId, env);
      return new Response('OK');
    }

    return new Response('Not found', { status: 404 });
  }
};

// --- Логика пользователя ---
async function handleUserFlow(chatId, env) {
  // 1. Проверка подписки
  const isMember = await checkSubscription(chatId);
  if (!isMember) {
    await sendSubscribeMessage(chatId);
    return;
  }

  // 2. Проверка регистрации
  const reg = await env.DB.prepare('SELECT * FROM Registrations WHERE "Telegram ID" = ? LIMIT 1').bind(chatId).first();
  if (!reg) {
    // Нет регистрации — отправить ссылку на регистрацию
    await sendRegistrationLink(chatId);
    return;
  }

  // 3. Проверка депозита
  const dep = await env.DB.prepare('SELECT * FROM Deposits WHERE "Telegram ID" = ? LIMIT 1').bind(chatId).first();
  if (!dep) {
    await sendMessage(chatId, 'Пожалуйста, сделайте депозит для продолжения.');
    return;
  }

  // 4. Главное меню
  await sendMessage(chatId, 'Вы попали в главное меню.');
}

// --- Проверка подписки ---
async function checkSubscription(userId) {
  const channel = CHANNEL_USERNAME.replace('@', '');
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${userId}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return data.ok && data.result.status !== 'left';
  } catch {
    return false;
  }
}

// --- Сообщения ---
async function sendMessage(chatId, text, reply_markup) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup })
  });
}

async function sendSubscribeMessage(chatId) {
  await sendMessage(chatId, 'Пожалуйста, подпишитесь на канал и нажмите кнопку ниже для проверки.', {
    inline_keyboard: [[{ text: 'Проверить подписку', callback_data: 'check_sub' }]]
  });
}

async function sendRegistrationLink(chatId) {
  await sendMessage(chatId, 'Для продолжения зарегистрируйтесь по ссылке:', {
    inline_keyboard: [[{ text: 'Зарегистрироваться', url: PARTNER_LINK + chatId }]]
  });
}

async function answerCallback(callback_query_id, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id, text, show_alert: true })
  });
} 