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
    const payload = {
      generated_at: new Date().toISOString(),
      page_url: global.location.href,
      telegram: {
        init_data_raw: tg ? tg.initData || null : null,
        init_data_unsafe: initUnsafe,
        chat_instance: initUnsafe ? initUnsafe.chat_instance || null : null,
        chat_type: initUnsafe ? initUnsafe.chat_type || null : null,
        start_param: initUnsafe ? initUnsafe.start_param || null : null,
        query_id: initUnsafe ? initUnsafe.query_id || null : null,
        auth_date: initUnsafe ? initUnsafe.auth_date || null : null,
        user: initUnsafe ? initUnsafe.user || null : null,
        receiver: initUnsafe ? initUnsafe.receiver || null : null
      },
      extra
    };
    return JSON.stringify(payload, null, 2);
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
