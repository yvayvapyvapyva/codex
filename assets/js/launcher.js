const { byId, getUserIdentity, getTokenFromUrl, apiRequest, getTelegramWebApp } = window.AppShared;

const state = {
  token: null,
  user: getUserIdentity(),
  gistId: null,
  routes: [],
  selected: null
};

const ui = {
  loading: byId('loadingScreen'),
  routesScreen: byId('routesScreen'),
  emptyScreen: byId('emptyScreen'),
  createScreen: byId('createScreen'),
  routesList: byId('routesList'),
  createNewBtn: byId('createNewBtn'),
  emptyCreateBtn: byId('emptyCreateBtn'),
  openActions: byId('openActions'),
  openEditorBtn: byId('openEditorBtn'),
  openNavigatorBtn: byId('openNavigatorBtn'),
  routeNameInput: byId('routeNameInput'),
  confirmCreateBtn: byId('confirmCreateBtn')
};

function getTokenParam() {
  return new URLSearchParams(window.location.search).get('t') || '';
}

function gistDesc() {
  const uname = state.user.username || '';
  return `[${state.user.id}] User: ${state.user.name} ${uname}`.trim();
}

function hideAllScreens() {
  ui.routesScreen.style.display = 'none';
  ui.emptyScreen.style.display = 'none';
  ui.createScreen.style.display = 'none';
}

function showRoutesScreen() {
  hideAllScreens();
  ui.routesScreen.style.display = 'flex';
}

function showEmptyScreen() {
  hideAllScreens();
  ui.emptyScreen.style.display = 'flex';
}

function showCreateScreen() {
  hideAllScreens();
  ui.createScreen.style.display = 'flex';
  ui.routeNameInput.value = '';
  ui.routeNameInput.focus();
}

function hideLoading() {
  ui.loading.style.display = 'none';
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
  ui.routesList.innerHTML = '';
  state.selected = null;
  ui.openActions.style.display = 'none';

  if (!state.routes.length) {
    ui.routesList.innerHTML = '<div class="empty">Маршрутов пока нет</div>';
    return;
  }

  state.routes.forEach((file) => {
    const name = file.replace('.json', '');
    const btn = document.createElement('button');
    btn.className = `route-item ${state.selected === file ? 'active' : ''}`;
    btn.textContent = name;
    btn.onclick = () => {
      state.selected = file;
      document.querySelectorAll('.route-item').forEach((node) => node.classList.remove('active'));
      btn.classList.add('active');
      ui.openActions.style.display = 'block';
    };
    ui.routesList.appendChild(btn);
  });
}

async function createRoute() {
  const name = (ui.routeNameInput.value || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!name) return;
  const fileName = `${name}.json`;

  const exists = state.routes.includes(fileName);
  if (exists) {
    ui.routeNameInput.focus();
    return;
  }

  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: { [fileName]: { content: '[]' } }
  });
  if (!ok) return;

  state.routes = await fetchRoutes();
  renderRoutes();
  hideLoading();
  showRoutesScreen();
}

function openEditor() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  const tokenParam = getTokenParam();
  window.location.href = `editor.html?route=${encodeURIComponent(routeName)}&t=${encodeURIComponent(tokenParam)}`;
}

function openNavigator() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  const tokenParam = getTokenParam();
  const navRoute = `${state.user.id}-${routeName}`;
  window.location.href = `nav.html?route=${encodeURIComponent(navRoute)}&t=${encodeURIComponent(tokenParam)}`;
}

async function init() {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.expand();
    tg.ready();
    if (tg.requestFullscreen) {
      try { tg.requestFullscreen(); } catch (e) {}
    }
  }

  state.token = getTokenFromUrl();
  if (!state.token) {
    ui.loading.textContent = 'ОШИБКА: НЕТ ПАРАМЕТРА t';
    return;
  }

  const gistOk = await ensureUserGist();
  if (!gistOk) {
    ui.loading.textContent = 'ОШИБКА ПОДКЛЮЧЕНИЯ К GITHUB';
    return;
  }

  state.routes = await fetchRoutes();
  hideLoading();

  if (state.routes.length) {
    renderRoutes();
    showRoutesScreen();
  } else {
    showEmptyScreen();
  }
}

ui.createNewBtn.onclick = showCreateScreen;
ui.emptyCreateBtn.onclick = showCreateScreen;
ui.confirmCreateBtn.onclick = createRoute;
ui.openEditorBtn.onclick = openEditor;
ui.openNavigatorBtn.onclick = openNavigator;

init();
