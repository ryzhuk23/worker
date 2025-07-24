addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const TELEGRAM_TOKEN = '8085303818:AAE1G-ekS5pWFqdTIR0eibXCMoWYNs77RaU';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const CHANNEL_USERNAME = '@your_channel_4';

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405 });
  }
  const update = await request.json();
  if (!update.message) {
    return new Response('No message', { status: 200 });
  }
  const chatId = update.message.chat.id;
  const userId = update.message.from.id;
  // Проверяем подписку
  const isMember = await checkSubscription(userId);
  let text;
  if (isMember === true) {
    text = 'Вы подписаны на канал!';
  } else if (isMember === false) {
    text = 'Вы не подписаны на канал!';
  } else {
    text = 'Не удалось проверить подписку.';
  }
  await sendMessage(chatId, text);
  return new Response('OK', { status: 200 });
}

async function checkSubscription(userId) {
  // Удаляем @ из username для getChatMember
  const channel = CHANNEL_USERNAME.replace('@', '');
  const url = `${TELEGRAM_API}/getChatMember?chat_id=@${channel}&user_id=${userId}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.ok) {
      // Если статус не "left", значит подписан
      return data.result.status !== 'left';
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function sendMessage(chatId, text) {
  const url = `${TELEGRAM_API}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
} 