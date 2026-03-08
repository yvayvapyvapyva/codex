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
  routesSelect: byId('routesSelect'),
  createNewBtn: byId('createNewBtn'),
  emptyCreateBtn: byId('emptyCreateBtn'),
  openActions: byId('openActions'),
  openEditorBtn: byId('openEditorBtn'),
  openNavigatorBtn: byId('openNavigatorBtn'),
  renameRouteBtn: byId('renameRouteBtn'),
  deleteRouteBtn: byId('deleteRouteBtn'),
  copyLinkBtn: byId('copyLinkBtn'),
  routeNameInput: byId('routeNameInput'),
  confirmCreateBtn: byId('confirmCreateBtn')
};

function getTokenParam() {
  return new URLSearchParams(window.location.search).get('t') || '';
}

function notify(text) {
  alert(text);
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
  ui.routesSelect.innerHTML = '<option value="">Выберите маршрут</option>';
  state.selected = null;
  ui.openActions.style.display = 'none';

  if (!state.routes.length) {
    return;
  }

  state.routes.forEach((file) => {
    const name = file.replace('.json', '');
    const option = document.createElement('option');
    option.value = file;
    option.textContent = name;
    ui.routesSelect.appendChild(option);
  });
}

async function createRoute() {
  const name = (ui.routeNameInput.value || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!name) {
    notify('Введите название маршрута.');
    return;
  }
  const fileName = `${name}.json`;

  const exists = state.routes.includes(fileName);
  if (exists) {
    notify('Маршрут с таким именем уже существует.');
    ui.routeNameInput.focus();
    return;
  }

  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: { [fileName]: { content: '[]' } }
  });
  if (!ok) {
    notify('Не удалось создать маршрут.');
    return;
  }

  const tokenParam = getTokenParam();
  const routeName = fileName.replace('.json', '');
  window.location.href = `editor.html?route=${encodeURIComponent(routeName)}&t=${encodeURIComponent(tokenParam)}`;
}

async function renameRoute() {
  if (!state.selected) return;
  const currentName = state.selected.replace('.json', '');
  const nextRaw = prompt('Новое название маршрута (разрешены: a-z, 0-9, _)', currentName);
  if (nextRaw === null) return;
  const nextName = nextRaw.trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!nextName) {
    notify('Некорректное имя маршрута.');
    return;
  }
  if (nextName === currentName) return;
  const nextFile = `${nextName}.json`;
  if (state.routes.includes(nextFile)) {
    notify('Маршрут с таким именем уже существует.');
    return;
  }

  const gist = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}?t=${Date.now()}`);
  if (!gist || !gist.files || !gist.files[state.selected]) {
    notify('Не удалось загрузить данные маршрута.');
    return;
  }
  const content = gist.files[state.selected].content || '[]';
  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: {
      [state.selected]: null,
      [nextFile]: { content }
    }
  });
  if (!ok) {
    notify('Не удалось переименовать маршрут.');
    return;
  }

  state.routes = await fetchRoutes();
  renderRoutes();
  state.selected = nextFile;
  ui.routesSelect.value = nextFile;
  ui.openActions.style.display = 'block';
  notify('Маршрут переименован.');
}

async function deleteRoute() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  if (!confirm(`Удалить маршрут ${routeName}?`)) return;
  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: { [state.selected]: null }
  });
  if (!ok) {
    notify('Не удалось удалить маршрут.');
    return;
  }

  state.routes = await fetchRoutes();
  if (!state.routes.length) {
    notify('Маршрут удалён.');
    showEmptyScreen();
    return;
  }
  renderRoutes();
  showRoutesScreen();
  notify('Маршрут удалён.');
}

async function copyRouteLink() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  const link = `https://t.me/e_ia_bot/nav?startapp=${state.user.id}-${routeName}`;
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e2) {
      copied = false;
    }
  }
  if (copied) notify('Ссылка скопирована в буфер обмена.');
  else prompt('Скопируйте ссылку вручную:', link);
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
ui.renameRouteBtn.onclick = renameRoute;
ui.deleteRouteBtn.onclick = deleteRoute;
ui.copyLinkBtn.onclick = copyRouteLink;
ui.routesSelect.onchange = (e) => {
  state.selected = e.target.value || null;
  ui.openActions.style.display = state.selected ? 'block' : 'none';
};

init();
