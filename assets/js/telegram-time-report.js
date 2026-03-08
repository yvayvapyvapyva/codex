(function (global) {
  async function sendCurrentTimeViaBot(botToken, chatId, opts = {}) {
    if (!botToken || !chatId) {
      throw new Error('botToken и chatId обязательны');
    }

    const timeZone = opts.timeZone || 'Europe/Moscow';
    const locale = opts.locale || 'ru-RU';
    const label = opts.label || 'Текущее время';

    const now = new Date();
    const formatted = new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);

    const text = `${label}: ${formatted} (${timeZone})`;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      const reason = data && data.description ? data.description : `HTTP ${res.status}`;
      throw new Error(`Не удалось отправить сообщение: ${reason}`);
    }

    return {
      ok: true,
      text,
      result: data.result
    };
  }

  global.TelegramTimeReport = {
    sendCurrentTimeViaBot
  };
})(window);
