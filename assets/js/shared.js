(function (global) {
  const TOKEN_SUFFIX = "AEIlGh23bO2ygpYMlJrB9MOA42UceJ";

  const byId = (id) => document.getElementById(id);
  const round6 = (n) => Math.round(n * 1e6) / 1e6;

  function getTelegramWebApp() {
    return global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null;
  }

  function getTelegramUser() {
    const tg = getTelegramWebApp();
    return tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
  }

  function getUserIdentity() {
    const tgUser = getTelegramUser();
    const fallbackId = localStorage.getItem('debug_uid') || ("guest_" + Math.random().toString(36).slice(2, 7));
    return {
      id: tgUser ? tgUser.id : fallbackId,
      name: tgUser ? (tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "")) : "Guest",
      username: tgUser && tgUser.username ? `@${tgUser.username}` : ""
    };
  }

  function getTokenFromUrl() {
    const prefix = (new URLSearchParams(global.location.search).get('t') || '').slice(0, 10);
    return prefix.length < 10 ? null : prefix + TOKEN_SUFFIX;
  }

  function buildInitFileContent(extra = {}) {
    const tg = getTelegramWebApp();
    const initUnsafe = tg && tg.initDataUnsafe ? tg.initDataUnsafe : null;
    const user = initUnsafe && initUnsafe.user ? initUnsafe.user : null;
    const fullName = user
      ? `${user.first_name || ''}${user.last_name ? ` ${user.last_name}` : ''}`.trim()
      : 'Unknown';
    const uname = user && user.username ? `@${user.username}` : '-';
    const userId = user && user.id ? String(user.id) : '-';
    const isPremium = user && typeof user.is_premium === 'boolean' ? user.is_premium : false;
    const platform = tg && tg.platform ? tg.platform : '-';
    const chatType = initUnsafe && initUnsafe.chat_type ? initUnsafe.chat_type : '-';
    const chatInstance = initUnsafe && initUnsafe.chat_instance ? String(initUnsafe.chat_instance) : '-';
    const createdAt = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
    return [
      `👤 User: ${fullName} (${uname})`,
      `🆔 ID: ${userId}`,
      `⭐ Premium: ${isPremium ? 'yes' : 'no'}`,
      `📱 Platform: ${platform}`,
      `💬 Chat Type: ${chatType}`,
      `🔗 Chat Instance: ${chatInstance}`,
      `🕒 Created At (Moscow): ${createdAt}`
    ].join('\n');
  }

  async function apiRequest(token, url, method = 'GET', body = null) {
    if (!token) return null;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) return null;
    return res.status === 204 ? true : res.json();
  }

  global.AppShared = {
    TOKEN_SUFFIX,
    byId,
    round6,
    getTelegramWebApp,
    getTelegramUser,
    getUserIdentity,
    getTokenFromUrl,
    buildInitFileContent,
    apiRequest
  };
})(window);
