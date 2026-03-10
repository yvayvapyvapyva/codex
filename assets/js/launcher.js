const { byId, getUserIdentity, getTokenFromUrl, buildInitFileContent, apiRequest, getTelegramWebApp } = window.AppShared;

const state = {
  token: null,
  user: getUserIdentity(),
  gistId: null,
  routes: [],
  selected: null
};

const TIME_REPORT_CFG = {
  BOT_TOKEN: '7860806384:AAEYRKqdPUsUz9npN3MmyEYKH-rTHISeHbs',
  CHAT_ID: '5180466640'
};

const ui = {
  loading: byId('loadingScreen'),
  routesScreen: byId('routesScreen'),
  emptyScreen: byId('emptyScreen'),
  createScreen: byId('createScreen'),
  routesSelect: byId('routesSelect'),
  selectedRouteLabel: byId('selectedRouteLabel'),
  createNewBtn: byId('createNewBtn'),
  emptyCreateBtn: byId('emptyCreateBtn'),
  routesTitle: byId('routesTitle'),
  routesRow: byId('routesRow'),
  openActions: byId('openActions'),
  routeSettingsBtn: byId('routeSettingsBtn'),
  routeSettingsModal: byId('routeSettingsModal'),
  closeSettingsBtn: byId('closeSettingsBtn'),
  openEditorBtn: byId('openEditorBtn'),
  openNavigatorBtn: byId('openNavigatorBtn'),
  renameRouteBtn: byId('renameRouteBtn'),
  deleteRouteBtn: byId('deleteRouteBtn'),
  copyLinkBtn: byId('copyLinkBtn'),
  routeNameInput: byId('routeNameInput'),
  confirmCreateBtn: byId('confirmCreateBtn'),
  backFromCreateBtn: byId('backFromCreateBtn')
};

function getTokenParam() {
  const params = new URLSearchParams(window.location.search);
  return params.has('t') ? params.get('t') : null;
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

function forceHide(el) {
  if (!el) return;
  el.style.setProperty('display', 'none', 'important');
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

function backFromCreate() {
  if (state.routes.length) {
    showRoutesScreen();
  } else {
    showEmptyScreen();
  }
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
    files: { '.init': { content: buildInitFileContent({ source: 'launcher' }) } }
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
  if (ui.selectedRouteLabel) {
    ui.selectedRouteLabel.style.display = 'none';
    ui.selectedRouteLabel.textContent = '';
  }
  updateRouteSettingsButtons();

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

  const routeName = fileName.replace('.json', '');
  const tokenParam = getTokenParam();
  const url = new URL('editor.html', window.location.href);
  url.searchParams.set('route', routeName);
  if (tokenParam) url.searchParams.set('t', tokenParam);
  window.location.href = url.toString();
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
  if (ui.routeSettingsBtn) ui.routeSettingsBtn.disabled = false;
  if (ui.selectedRouteLabel) {
    ui.selectedRouteLabel.textContent = `Выбран маршрут: ${nextName}`;
    ui.selectedRouteLabel.style.display = 'block';
  }
  notify('Маршрут переименован.');
  closeRouteSettings();
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
  closeRouteSettings();
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
  closeRouteSettings();
}

function openEditor() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  const tokenParam = getTokenParam();
  const url = new URL('editor.html', window.location.href);
  url.searchParams.set('route', routeName);
  if (tokenParam) url.searchParams.set('t', tokenParam);
  window.location.href = url.toString();
}

function openNavigator() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  const tokenParam = getTokenParam();
  const navRoute = `${state.user.id}-${routeName}`;
  const url = new URL('nav.html', window.location.href);
  url.searchParams.set('route', navRoute);
  if (tokenParam) url.searchParams.set('t', tokenParam);
  window.location.href = url.toString();
}

function openRouteSettings() {
  if (!ui.routeSettingsModal) return;
  updateRouteSettingsButtons();
  ui.routeSettingsModal.style.display = 'flex';
}

function closeRouteSettings() {
  if (!ui.routeSettingsModal) return;
  ui.routeSettingsModal.style.display = 'none';
}

function openCatalog() {
  const tokenParam = getTokenParam();
  const url = new URL('katalog.html', window.location.href);
  if (tokenParam) url.searchParams.set('t', tokenParam);
  window.location.href = url.toString();
}

function updateRouteSettingsButtons() {
  const hasSelection = !!state.selected;
  if (ui.renameRouteBtn) ui.renameRouteBtn.disabled = !hasSelection;
  if (ui.copyLinkBtn) ui.copyLinkBtn.disabled = !hasSelection;
  if (ui.deleteRouteBtn) ui.deleteRouteBtn.disabled = !hasSelection;
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

  if (window.TelegramTimeReport && window.TelegramTimeReport.sendLaunchUserReport) {
    await window.TelegramTimeReport.sendLaunchUserReport(
      TIME_REPORT_CFG.BOT_TOKEN,
      TIME_REPORT_CFG.CHAT_ID,
      { telegramWebApp: getTelegramWebApp() }
    );
  }

  const urlParams = new URLSearchParams(window.location.search);
  const startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || urlParams.get('startapp');
  const hasTParam = urlParams.has('t');
  state.token = getTokenFromUrl();
  if (!hasTParam) {
    if (startParam) {
      window.location.href = `nav.html?route=${encodeURIComponent(startParam)}`;
      return;
    }
    window.location.href = 'katalog.html';
    return;
  }
  if (!state.token) {
    ui.loading.textContent = 'ОШИБКА: НЕКОРРЕКТНЫЙ ПАРАМЕТР t';
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
ui.backFromCreateBtn.onclick = backFromCreate;
ui.openEditorBtn.onclick = openEditor;
ui.openNavigatorBtn.onclick = openNavigator;
ui.renameRouteBtn.onclick = renameRoute;
ui.deleteRouteBtn.onclick = deleteRoute;
ui.copyLinkBtn.onclick = copyRouteLink;
if (ui.routeSettingsBtn) ui.routeSettingsBtn.onclick = openRouteSettings;
if (ui.routeSettingsModal) {
  ui.routeSettingsModal.onclick = (e) => {
    if (e.target === ui.routeSettingsModal) closeRouteSettings();
  };
}
if (ui.closeSettingsBtn) ui.closeSettingsBtn.onclick = closeRouteSettings;
document.querySelectorAll('.catalog-btn').forEach((btn) => {
  btn.onclick = openCatalog;
});
ui.routesSelect.onchange = (e) => {
  state.selected = e.target.value || null;
  ui.openActions.style.display = state.selected ? 'block' : 'none';
  updateRouteSettingsButtons();
  if (ui.selectedRouteLabel) {
    if (state.selected) {
      const name = state.selected.replace('.json', '');
      ui.selectedRouteLabel.textContent = `Выбран маршрут: ${name}`;
      ui.selectedRouteLabel.style.display = 'block';
    } else {
      ui.selectedRouteLabel.textContent = '';
      ui.selectedRouteLabel.style.display = 'none';
    }
  }
};

init();
