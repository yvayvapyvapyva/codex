const { byId, getUserIdentity, getTokenFromUrl, apiRequest } = window.AppShared;

const state = {
  mode: 'editor',
  token: null,
  user: getUserIdentity(),
  gistId: null,
  routes: [],
  selected: null
};

const ui = {
  status: byId('statusText'),
  list: byId('routeList'),
  empty: byId('emptyBlock'),
  openBtn: byId('openBtn'),
  modeEditor: byId('modeEditor'),
  modeNav: byId('modeNav'),
  newName: byId('newRouteName')
};

function setStatus(text) {
  ui.status.textContent = text;
}

function setMode(mode) {
  state.mode = mode;
  ui.modeEditor.classList.toggle('active', mode === 'editor');
  ui.modeNav.classList.toggle('active', mode === 'nav');
}

function getTokenParam() {
  return new URLSearchParams(window.location.search).get('t') || '';
}

function gistDesc() {
  const uname = state.user.username || '';
  return `[${state.user.id}] User: ${state.user.name} ${uname}`.trim();
}

async function ensureUserGist() {
  if (state.gistId) return true;
  const gists = await apiRequest(state.token, `https://api.github.com/gists?per_page=100&t=${Date.now()}`);
  if (!gists) return false;
  const existing = gists.find((g) => (g.description || '').includes(`[${state.user.id}]`));
  if (existing) {
    state.gistId = existing.id;
    return true;
  }
  const created = await apiRequest(state.token, 'https://api.github.com/gists', 'POST', {
    description: gistDesc(),
    public: true,
    files: { '.init': { content: 'Init' } }
  });
  if (!created) return false;
  state.gistId = created.id;
  return true;
}

async function fetchRoutes() {
  const gist = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}?t=${Date.now()}`);
  if (!gist) return [];
  return Object.keys(gist.files || {})
    .filter((fn) => fn.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
}

function renderRoutes() {
  ui.list.innerHTML = '';
  if (!state.routes.length) {
    ui.list.innerHTML = '<div style="padding:14px;color:#c7c9d1;text-align:center;">Маршрутов пока нет</div>';
    ui.empty.style.display = 'grid';
    state.selected = null;
    return;
  }
  ui.empty.style.display = 'none';
  if (!state.selected) state.selected = state.routes[0];
  state.routes.forEach((file) => {
    const name = file.replace('.json', '');
    const btn = document.createElement('button');
    btn.className = `route-item ${state.selected === file ? 'active' : ''}`;
    btn.textContent = name;
    btn.onclick = () => {
      state.selected = file;
      renderRoutes();
    };
    ui.list.appendChild(btn);
  });
}

async function createFirstRoute() {
  const name = (ui.newName.value || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!name) return;
  const fileName = `${name}.json`;
  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: { [fileName]: { content: '[]' } }
  });
  if (!ok) {
    setStatus('Ошибка создания маршрута');
    return;
  }
  ui.newName.value = '';
  state.routes = await fetchRoutes();
  state.selected = fileName;
  renderRoutes();
  setStatus('Маршрут создан');
}

function openSelected() {
  if (!state.selected) {
    setStatus('Сначала создайте маршрут');
    return;
  }
  const routeName = state.selected.replace('.json', '');
  const tokenParam = getTokenParam();
  if (state.mode === 'editor') {
    window.location.href = `editor.html?route=${encodeURIComponent(routeName)}&t=${encodeURIComponent(tokenParam)}`;
    return;
  }
  const navRoute = `${state.user.id}-${routeName}`;
  window.location.href = `nav.html?route=${encodeURIComponent(navRoute)}&t=${encodeURIComponent(tokenParam)}`;
}

async function init() {
  const tg = window.AppShared.getTelegramWebApp();
  if (tg) {
    tg.expand();
    tg.ready();
    if (tg.requestFullscreen) {
      try { tg.requestFullscreen(); } catch (e) {}
    }
  }
  setMode('editor');
  state.token = getTokenFromUrl();
  if (!state.token) {
    setStatus('Ошибка: параметр t должен содержать минимум 10 символов');
    ui.openBtn.disabled = true;
    return;
  }
  setStatus('Подключение к GitHub...');
  const ok = await ensureUserGist();
  if (!ok) {
    setStatus('Ошибка авторизации GitHub');
    ui.openBtn.disabled = true;
    return;
  }
  state.routes = await fetchRoutes();
  renderRoutes();
  setStatus(`ID: ${state.user.id}`);
}

ui.modeEditor.onclick = () => setMode('editor');
ui.modeNav.onclick = () => setMode('nav');
ui.openBtn.onclick = openSelected;
byId('createRouteBtn').onclick = createFirstRoute;

init();
