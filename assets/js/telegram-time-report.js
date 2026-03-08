(function (global) {
  function toJsonSafe(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  function splitTextByLength(text, maxLen) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLen) {
      chunks.push(text.slice(i, i + maxLen));
    }
    return chunks;
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
    const ask = opts.askConsent || ((text) => global.confirm(text));
    const geo = opts.geolocation || global.navigator.geolocation;

    const allowUserReport = ask('Разрешаете отправить через Telegram бота отчет о данных пользователя?');
    if (!allowUserReport) return { ok: false, reason: 'user_report_denied' };

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
    const reportObject = {
      generated_at: new Date().toISOString(),
      platform: tg ? tg.platform : null,
      version: tg ? tg.version : null,
      color_scheme: tg ? tg.colorScheme : null,
      init_data: tg ? tg.initData || null : null,
      init_data_unsafe: rawUnsafe,
      user
    };
    const reportText = `USER REPORT\n${toJsonSafe(reportObject)}`;
    const chunks = splitTextByLength(reportText, 3900);

    try {
      for (let i = 0; i < chunks.length; i += 1) {
        const chunkLabel = chunks.length > 1 ? `\n[${i + 1}/${chunks.length}]` : '';
        await sendMessage(`${chunks[i]}${chunkLabel}`);
      }

      const allowLocation = ask('Разрешаете отправить геолокацию при первом получении местоположения?');
      if (allowLocation && geo) {
        geo.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            await sendLocation(lat, lon);
          },
          () => {},
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
    sendLaunchUserReport
  };
})(window);
