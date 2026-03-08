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
    apiRequest
  };
})(window);
