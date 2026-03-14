const { byId, round6, getTelegramWebApp, getUserIdentity, getTokenFromUrl, buildInitFileContent, apiRequest } = window.AppShared;
const $ = byId;
const f6 = round6;
const tg = getTelegramWebApp();
const identity = getUserIdentity();
const USER_ID = identity.id;
const USER_NAME = identity.name;
const USER_UNAME = identity.username;
const REPORT_CFG = {
    BOT_TOKEN: '7860806384:AAEYRKqdPUsUz9npN3MmyEYKH-rTHISeHbs',
    CHAT_ID: '5180466640'
};
const GIST_DESC = `[${USER_ID}] User: ${USER_NAME} ${USER_UNAME}`;
const COLORS = { Gold: { hex: '#FFD700', label: 'Маневры на перекрестке' }, Blue: { hex: '#007AFF', label: 'Разворот вне перекрестка' }, Red: { hex: '#FF3B30', label: 'Разгон до максимальной скорости' }, Fuchsia: { hex: '#AF52DE', label: 'Остановка и начало движения на подъем' }, Orange: { hex: '#FF9500', label: 'Левые и правые повороты' }, Purple: { hex: '#5856D6', label: 'Параллельная парковка и гараж' }, Cyan: { hex: '#5AC8FA', label: 'Разворот в ограниченном пространстве' }, Brown: { hex: '#A2845E', label: 'Остановка' }, Lime: { hex: '#34C759', label: 'Начало движения' } };
const COMMAND_SETS = { Gold: ["На перекрестке повернем налево", "На перекрестке едем прямо", "На перекрестке повернем направо", "На перекрестке выполним разворот", "На круговом движении первый съезд", "На круговом движении второй съезд", "На круговом движении третий съезд", "На круговом движении четвертый съезд", "На круговом движении выполним разворот", "На регулируемом перекрестке повернем налево", "На регулируемом перекрестке едем прямо", "На регулируемом перекрестке повернем направо", "На регулируемом перекрестке выполним разворот", "На нерегулируемом перекрестке повернем налево", "На нерегулируемом перекрестке едем прямо", "На нерегулируемом перекрестке повернем направо", "На нерегулируемом перекрестке выполним разворот", "Выполним разворот в ближайшем разрешенном месте"], Blue: ["Выполним разворот вне перекрестка", "Выполним разворот в ближайшем разрешенном месте", "Найдите место для разворота и развернитесь"], Red: ["Выполняем разгон до максимальной скорости", "Набираем максимальную скорость на данном участке дороги", "Разгоняемся до максимальной разрешенной скорости"], Fuchsia: ["По моей команде выполним остановку и начало движения на подъеме", "Выполняем остановку и начало движения на подъеме"], Orange: ["Поворачиваем направо", "Поворачиваем налево", "Далее повернем направо", "Далее повернем налево", "На светофоре повернем направо", "На светофоре повернем налево", "Поворачиваем направо к ленте", "Поворачиваем направо на заправку", "Едем в прямом направлении"], Purple: ["Выполняем параллельную парковку и гараж"], Cyan: ["Выполняем разворот в ограниченном пространстве", "Выполним разворот в ограниченном пространстве с использованием передачи заднего хода"], Brown: ["Выполняем остановку параллельно краю проезжей части", "Выполняем остановку в ближайшем разрешенном месте"], Lime: ["Начинаем движение", "Как будете готовы начинаем движение"] };
let map, points = [], cur = null, isAdd = false, isDrawing = false, curFile = null, userGistId = null, activeListPoint = null, modalMode = 'list', tempNewPointData = null, userLocPlacemark = null, activePoint = null, authToken = "", settingsRouteFiles = [];
let historyStack = [], historyIndex = -1, lastSavedSnapshot = "[]", toastTimer = null;

const showToast = (text, type = 'info', duration = 2200) => {
    const el = $('toast');
    el.textContent = text;
    el.className = '';
    el.classList.add(type || 'info');
    if (toastTimer) clearTimeout(toastTimer);
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
};
const getSvg = (col, txt, az, isEnd) => { const s = isEnd ? 34 : 40, c = s/2; return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g transform="rotate(${az},${c},${c})"><polygon points="${c},2 ${s*0.75},${s-5} ${c},${s*0.65} ${s*0.25},${s-5}" fill="${col}" stroke="#000" stroke-width="1.5"/></g><circle cx="${c}" cy="${c}" r="${isEnd?7:9}" fill="${col}" stroke="#000" stroke-width="1"/><text x="${c}" y="${c+3}" font-size="10" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="2.5" style="paint-order:stroke fill">${txt}</text></svg>`); };
const getUserLocSvg = () => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#007AFF" stroke="white" stroke-width="3"/><circle cx="12" cy="12" r="11" fill="none" stroke="#007AFF" stroke-width="1" opacity="0.3"/></svg>`);
const calcA = (p1, p2) => p1 && p2 ? Math.round((Math.atan2(Math.cos(Math.PI/180*p1[0])*(p2[1]-p1[1]), p2[0]-p1[0])*180/Math.PI+360)%360) : 0;
const api = async (u, m = 'GET', b = null) => apiRequest(authToken, u, m, b);
const serializePoints = () => JSON.stringify(points.map(p => ({ id: p.id, color: p.color, pts: p.pts, cmd: p.cmd, comm: p.comm })));
const clearRouteObjects = () => {
    points.forEach(p => { map.geoObjects.remove(p.pm); map.geoObjects.remove(p.line); if (p.pmEnd) map.geoObjects.remove(p.pmEnd); });
    points = [];
    activePoint = null;
};
const updateHistoryButtons = () => {
    return;
};
const seedHistory = () => {
    historyStack = [serializePoints()];
    historyIndex = 0;
    updateHistoryButtons();
};
const pushHistorySnapshot = () => {
    const snap = serializePoints();
    if (historyStack[historyIndex] === snap) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snap);
    historyIndex = historyStack.length - 1;
    updateHistoryButtons();
};
const updateSaveState = () => {
    const hasRoute = curFile !== null;
    const isDirty = hasRoute && serializePoints() !== lastSavedSnapshot;
    $('floatingSave').style.display = isDirty ? 'flex' : 'none';
    const saveBtn = $('saveStateBtn');
    if (!saveBtn) return;
    saveBtn.textContent = 'Сохранить изменения';
    saveBtn.disabled = !isDirty || !hasRoute;
};
const syncActiveListCard = () => {
    document.querySelectorAll('.sortable-point-item').forEach(card => {
        card.classList.toggle('active', !!activePoint && parseInt(card.dataset.id) === activePoint.id);
    });
};
const setActivePoint = (p, center = false) => {
    activePoint = p || null;
    points.forEach(pt => {
        const active = activePoint && pt === activePoint;
        pt.line.options.set({ strokeWidth: 3, strokeOpacity: active ? 1 : 0.8 });
        pt.pm.options.set('zIndex', active ? 1800 : 1000);
        if (pt.pmEnd) pt.pmEnd.options.set('zIndex', active ? 1600 : 800);
    });
    if (center && activePoint?.pts?.length) map.setCenter(activePoint.pts[0]);
    syncActiveListCard();
};
const applySnapshot = (snapshot) => {
    const data = JSON.parse(snapshot || "[]");
    clearRouteObjects();
    data.forEach(d => addP(d.pts[0], d, true));
    recalculateIds();
    setActivePoint(null);
    updateSaveState();
};
ymaps.ready(() => {
    if (tg) tg.expand();
    if (tg && tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
    }
    if (tg && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    if (tg && tg.setHeaderColor) tg.setHeaderColor('secondary_bg_color');
    $('userIdBadge').textContent = `ID: ${USER_ID}`;
    map = new ymaps.Map("map", { center: [56.3399, 43.9332], zoom: 17, type: 'yandex#satellite', controls: [] });
    userLocPlacemark = new ymaps.Placemark([0,0], {}, { iconLayout: 'default#image', iconImageHref: getUserLocSvg(), iconImageSize: [24,24], iconImageOffset: [-12,-12], zIndex: 5000, visible: false });
    map.geoObjects.add(userLocPlacemark); initGeolocation();
    map.events.add('click', e => {
        if(isAdd && tempNewPointData) {
            const newPoint = addP(e.get('coords'), { ...tempNewPointData });
            pushHistorySnapshot();
            updateSaveState();
            setActivePoint(newPoint, false);
            startDrawingForPoint(newPoint, true);
            tempNewPointData = null;
        }
    });
    initColorDropdown('listColorDropdown', (h, n) => {
        if(activeListPoint) {
            pushHistorySnapshot();
            const { point: p, card: c } = activeListPoint; p.color = n; c.querySelector('.color-indicator-btn').style.background = h;
            const sel = c.querySelector('.cmd-select'); updateCommandOptions(sel, n, ""); p.cmd = sel.value;
            if (p.line) { p.line.options.set('strokeColor', h); updI(p); if(p.pmEnd) updPI(p); } activeListPoint = null;
            pushHistorySnapshot();
            updateSaveState();
        }
    });
    new Sortable($('pointsSortList'), { animation: 150, handle: '.sort-handle', ghostClass: 'sortable-ghost', onEnd: reorderPointsFromList });
    
    localStorage.removeItem('gh_t_optimized');
    const settingsRouteSelect = $('settingsRouteSelect');
    if (settingsRouteSelect) settingsRouteSelect.addEventListener('change', onSettingsRouteSelect);
    const resolvedToken = getTokenFromUrl();
    if (!resolvedToken) {
        showToast("Ошибка: параметр t должен содержать минимум 10 символов", 'error', 3200);
        return;
    }
    authToken = resolvedToken;
    handleInitialAuth();
});

const initGeolocation = () => { if (navigator.geolocation) navigator.geolocation.watchPosition(p => { if (userLocPlacemark) { userLocPlacemark.geometry.setCoordinates([p.coords.latitude, p.coords.longitude]); userLocPlacemark.options.set('visible', true); }}, null, { enableHighAccuracy: true, maximumAge: 5000 }); };
const getRouteFromUrl = () => {
    const raw = (new URLSearchParams(window.location.search).get('route') || '').trim();
    if (!raw) return null;
    const normalized = raw.endsWith('.json') ? raw : `${raw}.json`;
    return normalized;
};
const getTokenParam = () => new URLSearchParams(window.location.search).get('t') || '';
const goHome = () => { const t = getTokenParam(); window.location.href = `index.html?t=${encodeURIComponent(t)}`; };
const handleInitialAuth = async () => {
    // Ищем существующий гист, но не создаём новый
    userGistId = await findUserGist();
    
    if(userGistId) {
        $('welcomeScreen').style.display = 'none';
        seedHistory();
        updateSaveState();
        $('uiControls').style.display = 'flex';
        $('bottomControls').style.display = 'flex';
        await refreshFileList();
        const routeFromUrl = getRouteFromUrl();
        if (routeFromUrl) {
            const exists = settingsRouteFiles.includes(routeFromUrl);
            if (!exists) await api(`https://api.github.com/gists/${userGistId}`, 'PATCH', { files: { [routeFromUrl]: { content: "[]" } } });
            await refreshFileList();
            await loadRoute(routeFromUrl);
        } else if (settingsRouteFiles.length) {
            await loadRoute(settingsRouteFiles[0]);
        } else {
            showToast("Создайте первый маршрут в настройках", 'info');
            openSettingsModal();
        }
        showToast("Вход выполнен", 'success');
    } else {
        // Гиста нет - показываем приветственный экран, гист будет создан при создании маршрута
        $('welcomeScreen').style.display = 'none';
        seedHistory();
        updateSaveState();
        $('uiControls').style.display = 'flex';
        $('bottomControls').style.display = 'flex';
        showToast("Создайте первый маршрут в настройках", 'info');
        openSettingsModal();
    }
};
const findUserGist = async () => {
    let allGists = [];
    let page = 1;
    const perPage = 100;
    while (true) {
        const gists = await api(`https://api.github.com/gists?per_page=${perPage}&page=${page}&t=${Date.now()}`);
        if(!gists || gists.length === 0) break;
        allGists = allGists.concat(gists);
        if (gists.length < perPage) break;
        page++;
    }
    if(!allGists) return null;
    const ex = allGists.find(g => g.description?.includes(`[${USER_ID}]`));
    return ex ? ex.id : null;
};

const ensureUserGist = async () => {
    if(userGistId) return true;
    let allGists = [];
    let page = 1;
    const perPage = 100;
    while (true) {
        const gists = await api(`https://api.github.com/gists?per_page=${perPage}&page=${page}&t=${Date.now()}`);
        if(!gists || gists.length === 0) break;
        allGists = allGists.concat(gists);
        if (gists.length < perPage) break;
        page++;
    }
    if(!allGists) return false;
    const ex = allGists.find(g => g.description?.includes(`[${USER_ID}]`));
    if(ex) { userGistId = ex.id; return true; }
    const cr = await api('https://api.github.com/gists', 'POST', { description: GIST_DESC, public: true, files: { ".init": { content: buildInitFileContent({ source: 'editor' }) } } });
    if(cr) { userGistId = cr.id; return true; }
    return false;
};
const renderSettingsFileList = () => {
    const sel = $('settingsRouteSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Выберите маршрут</option>';
    settingsRouteFiles.forEach(fn => {
        const op = document.createElement('option');
        op.value = fn;
        op.textContent = fn.replace('.json', '');
        sel.appendChild(op);
    });
    sel.value = curFile || "";
};
const refreshFileList = async () => {
    const g = await api(`https://api.github.com/gists/${userGistId}?t=${Date.now()}`); if(!g) return;
    settingsRouteFiles = Object.keys(g.files).filter(fn => fn.endsWith('.json')).sort((a, b) => a.localeCompare(b));
    renderSettingsFileList();
    updateVisibility();
};

const updateVisibility = () => {
    const act = curFile !== null; $('listPointsBtn').style.visibility = act ? 'visible' : 'hidden'; $('addMarkerBtn').style.visibility = act ? 'visible' : 'hidden';
    if(curFile) { const n = curFile.replace('.json',''); if ($('fileActions')) $('fileActions').style.display = 'block'; $('routeLabelText').textContent = n; }
    else { if ($('fileActions')) $('fileActions').style.display = 'none'; $('routeLabelText').textContent = 'Маршрут'; }
    renderSettingsFileList();
    updateSaveState();
};

const handleCreateNew = async () => {
    const n = $('newRouteName').value.trim(), fn = n + '.json', btn = $('btnCreateFile');
    if(!n) return;
    
    // Создаём гист если его нет
    const gistOk = await ensureUserGist();
    if(!gistOk || !userGistId) {
        btn.disabled = false;
        btn.textContent = "Создать";
        showToast("Ошибка подключения к GitHub", 'error');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = "...";
    if(await api(`https://api.github.com/gists/${userGistId}`, 'PATCH', { files: { [fn]: { content: "[]" } } })) {
        $('newRouteName').value = '';
        setTimeout(() => { refreshFileList(); loadRoute(fn); btn.disabled = false; btn.textContent = "Создать"; showToast("Маршрут создан", 'success'); }, 1000);
    }
    else { btn.disabled = false; btn.textContent = "Создать"; showToast("Ошибка создания", 'error'); }
};

const loadRoute = async (fn) => {
    const g = await api(`https://api.github.com/gists/${userGistId}?t=${Date.now()}`); if(!g) return;
    const data = JSON.parse(g.files[fn]?.content || "[]");
    clearRouteObjects();
    curFile = fn;
    data.forEach(d => addP(d.pts[0], d, true));
    if(points.length) map.setCenter(points[0].pts[0]);
    recalculateIds();
    document.querySelectorAll('.gist-item').forEach(it => it.classList.toggle('active', it.textContent.includes(fn.replace('.json',''))));
    seedHistory();
    lastSavedSnapshot = serializePoints();
    updateVisibility();
    setActivePoint(points[0] || null);
    showToast(`Загружен: ${fn.replace('.json','')}`, 'success');
    if (window.TelegramTimeReport && window.TelegramTimeReport.sendRouteLaunchReport) {
        const routeName = fn.replace('.json', '');
        window.TelegramTimeReport.sendRouteLaunchReport(
            REPORT_CFG.BOT_TOKEN,
            REPORT_CFG.CHAT_ID,
            { routeName, userName: USER_NAME, username: USER_UNAME, source: 'editor', telegramWebApp: tg }
        );
    }
};

const renameActiveRoute = async () => {
    if (!curFile || !userGistId) return;
    const currentName = curFile.replace('.json', '');
    const nextNameRaw = prompt('Новое имя маршрута (разрешены: a-z, 0-9, _)', currentName);
    if (nextNameRaw === null) return;
    const nextName = nextNameRaw.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!nextName) return;
    const nextFile = `${nextName}.json`;
    if (nextFile === curFile) return;
    const g = await api(`https://api.github.com/gists/${userGistId}?t=${Date.now()}`);
    if (!g || !g.files[curFile] || g.files[nextFile]) {
        showToast(g?.files?.[nextFile] ? 'Маршрут с таким именем уже есть' : 'Ошибка переименования', 'error');
        return;
    }
    const content = g.files[curFile].content || "[]";
    const ok = await api(`https://api.github.com/gists/${userGistId}`, 'PATCH', { files: { [curFile]: null, [nextFile]: { content } } });
    if (ok) {
        curFile = nextFile;
        updateVisibility();
        refreshFileList();
        showToast('Маршрут переименован', 'success');
    } else {
        showToast('Ошибка переименования', 'error');
    }
};

const deleteActiveRoute = async () => { if(curFile && confirm(`Удалить маршрут ${curFile.replace('.json','')}?`) && await api(`https://api.github.com/gists/${userGistId}`, 'PATCH', { files: { [curFile]: null } })) { clearRouteObjects(); curFile = null; seedHistory(); lastSavedSnapshot = "[]"; refreshFileList(); showToast("Маршрут удален", 'success'); } };
const shareActiveRoute = () => { if(!curFile) return; const link = `t.me/e_ia_bot/nav?startapp=${USER_ID}-${curFile.replace('.json','')}`, el = document.createElement('textarea'); el.value = link; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); showToast("Ссылка скопирована", 'success'); };
const launchNavigatorWithCurrentRoute = () => { if(!curFile) return; const routeName = curFile.replace('.json',''); const t = getTokenParam(); window.location.href = `nav.html?route=${encodeURIComponent(`${USER_ID}-${routeName}`)}&t=${encodeURIComponent(t)}`; };
const openSettingsModal = () => { refreshFileList(); toggleM('settingsModal'); };
const onSettingsRouteSelect = async (e) => {
    const fn = e.target.value || '';
    if (!fn || fn === curFile) return;
    await loadRoute(fn);
};
const toggleM = id => { const m = $(id); m.style.display = (m.style.display === 'none' || !m.style.display) ? 'flex' : 'none'; };
const closeD = () => { document.querySelectorAll('.color-dropdown').forEach(dr => dr.style.display = 'none'); $('dropdownOverlay').style.display = 'none'; };
const toggleD = id => { const d = $(id), vis = d.style.display === 'flex'; closeD(); if(!vis) { d.style.display = 'flex'; $('dropdownOverlay').style.display = 'block'; } };
const initColorDropdown = (id, cb) => Object.entries(COLORS).forEach(([n, d]) => { const r = Object.assign(document.createElement('div'), { className: 'color-row', onclick: (e) => { e.stopPropagation(); cb(d.hex, n); closeD(); }, innerHTML: `<div class="swatch" style="background:${d.hex}"></div><div style="font-weight:600;">${d.label}</div>` }); $(id).appendChild(r); });
const updateCommandOptions = (sel, col, val = "") => { sel.innerHTML = ''; (COMMAND_SETS[col] || ["Без команды"]).forEach(cmd => sel.appendChild(Object.assign(document.createElement('option'), { value: cmd, text: cmd, selected: cmd === val }))); };

function addP(coords, data = null, silent = false) {
    const p = { id: data?.id || (points.length + 1), color: data?.color || 'Gold', cmd: data?.cmd || '', comm: data?.comm || '', pts: data?.pts || [coords], pm: new ymaps.Placemark(coords, {}, { iconLayout: 'default#imageWithContent', iconImageSize: [40,40], iconImageOffset: [-20,-20], zIndex: 1000 }), line: new ymaps.Polyline(data?.pts || [coords], {}, { strokeWidth: 3, strokeOpacity: 0.8, zIndex: 500 }), pmEnd: null };
    p.line.options.set('strokeColor', COLORS[p.color].hex);
    p.pm.geometry.events.add('change', () => { const nc = p.pm.geometry.getCoordinates(), pts = p.line.geometry.getCoordinates(); if(pts.length) { pts[0] = nc; p.line.geometry.setCoordinates(pts); } });
    p.line.geometry.events.add('change', () => {
        p.pts = p.line.geometry.getCoordinates().map(pt => [f6(pt[0]), f6(pt[1])]);
        if(isDrawing && p.pts.length > 1) {
            $('addText').textContent = "Завершить рисование пути";
        }
        updI(p);
        if (p.pts.length > 1) updPI(p);
    });
    p.pm.events.add('click', () => { setActivePoint(p, true); if(!isAdd && !isDrawing) openEditPointModal(p); });
    map.geoObjects.add(p.pm);
    map.geoObjects.add(p.line);
    points.push(p);
    updI(p);
    if (p.pts.length > 1) updPI(p);
    if (!silent) updateSaveState();
    return p;
}

const startDrawingForPoint = (p, isNewPoint = false) => {
    isAdd = false;
    isDrawing = true;
    $('addText').textContent = "Рисуйте путь...";
    $('addMarkerBtn').classList.remove('active');
    $('addMarkerBtn').classList.add('drawing');
    cur = p;
    setActivePoint(p, !isNewPoint);
    p.line.editor.startDrawing();
    p.pm.options.set('draggable', true);
};
const stopDrawingMode = () => {
    if (cur) {
        cur.pm.options.set('draggable', false);
        cur.line.editor.stopEditing();
        pushHistorySnapshot();
        updateSaveState();
    }
    isDrawing = false;
    $('addText').textContent = "Добавить новую точку";
    $('addMarkerBtn').classList.remove('drawing');
    cur = null;
};
const handleAddBtnClick = () => { if(isDrawing) stopDrawingMode(); else if(isAdd) stopAdd(); else openCreatePointModal(); };
const stopAdd = () => { isAdd = false; tempNewPointData = null; $('addText').textContent = "Добавить новую точку"; $('addMarkerBtn').classList.remove('active'); map.setCursor('grab'); };
const updI = p => { p.pm.options.set('iconImageHref', getSvg(COLORS[p.color].hex, p.id, (p.pts?.length >= 2 ? calcA(p.pts[0], p.pts[1]) : 0), false)); };
function updPI(p) { const pts = p.line.geometry.getCoordinates(); if(!pts.length) return; const last = pts[pts.length-1], prev = pts[pts.length-2]; if(!p.pmEnd) { p.pmEnd = new ymaps.Placemark(last, {}, { iconLayout: 'default#imageWithContent', iconImageSize: [34,34], iconImageOffset: [-17,-17], interactive: false, zIndex: 800 }); map.geoObjects.add(p.pmEnd); } else p.pmEnd.geometry.setCoordinates(last); p.pmEnd.options.set({ iconImageHref: getSvg(COLORS[p.color].hex, p.id, prev ? calcA(prev, last) : 0, true) }); }

function recalculateIds() {
    points.forEach((p, i) => { p.id = i + 1; updI(p); if(p.pmEnd) updPI(p); });
    const list = $('pointsSortList'); if (list && list.children.length === points.length) Array.from(list.children).forEach((c, i) => { const n = c.querySelector('.point-number-text'); if(n) n.textContent = i + 1; c.dataset.id = i + 1; });
    syncActiveListCard();
}

function createPointCard(p, single = false) {
    const item = document.createElement('div'); item.className = 'sortable-point-item'; item.dataset.id = p.id;
    item.innerHTML = `${!single ? '<div class="sort-handle">☰</div>' : ''}<div class="item-main-row"><div class="point-number-text">${p.id || '?'}</div><div class="color-indicator-btn" style="background:${COLORS[p.color].hex}"></div><select class="cmd-select"></select></div><textarea class="comm-input" placeholder="комментарий">${p.comm || ''}</textarea><div class="item-actions"><button class="btn-item-action btn-path">🖋️ Изменить путь</button><button class="btn-item-action btn-del" style="color:var(--danger)">🗑️ Удалить</button></div>`;
    const sel = item.querySelector('.cmd-select'); updateCommandOptions(sel, p.color, p.cmd);
    const comm = item.querySelector('.comm-input');
    
    // Автоматическая высота для комментария
    const autoHeight = () => { comm.style.height = 'auto'; comm.style.height = comm.scrollHeight + 'px'; };
    comm.addEventListener('input', () => { p.comm = comm.value; autoHeight(); updateSaveState(); });
    comm.addEventListener('blur', () => { pushHistorySnapshot(); updateSaveState(); });
    setTimeout(autoHeight, 0);

    item.querySelector('.color-indicator-btn').onclick = e => { e.stopPropagation(); activeListPoint = { point: p, card: item }; toggleD('listColorDropdown'); };
    sel.onchange = () => { p.cmd = sel.value; pushHistorySnapshot(); updateSaveState(); };
    item.onclick = e => {
        if (e.target.closest('.btn-item-action') || e.target.closest('.color-indicator-btn') || e.target.closest('.cmd-select') || e.target.closest('.comm-input')) return;
        setActivePoint(p, true);
    };
    item.querySelector('.btn-del').onclick = () => { if(confirm("Удалить точку?")) { pushHistorySnapshot(); delPoint(p); pushHistorySnapshot(); updateSaveState(); if(single) toggleM('pointsOrderModal'); else openPointsOrderModal(); showToast("Точка удалена", 'info'); } };
    item.querySelector('.btn-path').onclick = () => { toggleM('pointsOrderModal'); startEditPath(p); };
    return item;
}

function delPoint(p) {
    points = points.filter(x => x !== p);
    map.geoObjects.remove(p.pm);
    map.geoObjects.remove(p.line);
    if(p.pmEnd) map.geoObjects.remove(p.pmEnd);
    if (activePoint === p) activePoint = null;
    recalculateIds();
    setActivePoint(points[0] || null);
}
function startEditPath(p) {
    cur = p;
    isDrawing = true;
    $('addText').textContent = "Завершить рисование пути";
    $('addMarkerBtn').classList.add('drawing');
    p.pm.options.set('draggable', true);
    p.line.editor.startEditing();
    setActivePoint(p, true);
}

function openPointsOrderModal() {
    modalMode = 'list'; const list = $('pointsSortList'); list.innerHTML = ''; $('orderModalTitle').textContent = curFile ? curFile.replace('.json', '') : "Маршрут"; $('saveInListBtn').style.display = 'none';
    if (!points.length) list.innerHTML = '<div style="text-align:center;padding:40px;color:#c7c9d1;font-weight:500;">Маршрут пока пуст</div>'; else points.forEach(p => list.appendChild(createPointCard(p)));
    syncActiveListCard();
    toggleM('pointsOrderModal');
}

function openEditPointModal(p) { modalMode = 'edit'; $('pointsSortList').innerHTML = ''; $('orderModalTitle').textContent = `Точка #${p.id}`; $('saveInListBtn').style.display = 'block'; $('saveBtnText').textContent = "Готово"; $('pointsSortList').appendChild(createPointCard(p, true)); syncActiveListCard(); toggleM('pointsOrderModal'); }
function openCreatePointModal() {
    modalMode = 'create';
    $('pointsSortList').innerHTML = '';
    $('orderModalTitle').textContent = "Новая точка";
    $('saveInListBtn').style.display = 'block';
    $('saveBtnText').textContent = "Поставить на карту";
    tempNewPointData = { id: points.length + 1, color: 'Gold', cmd: COMMAND_SETS.Gold[0], comm: '' };
    $('pointsSortList').appendChild(createPointCard(tempNewPointData, true));
    toggleM('pointsOrderModal');
}

function handleModalSave() {
    if (modalMode === 'list') saveGist();
    else if (modalMode === 'edit') toggleM('pointsOrderModal');
    else if (modalMode === 'create') {
        toggleM('pointsOrderModal');
        isAdd = true;
        $('addMarkerBtn').classList.add('active');
        $('addText').textContent = "Выберите место на карте";
        map.setCursor('crosshair');
    }
}

function reorderPointsFromList() {
    pushHistorySnapshot();
    points = Array.from($('pointsSortList').children).map(c => points.find(p => p.id === parseInt(c.dataset.id))).filter(p => !!p);
    recalculateIds();
    pushHistorySnapshot();
    updateSaveState();
}
async function saveGist() {
    if(!userGistId || !curFile) return;
    const btn = $('saveInListBtn');
    const topSaveBtn = $('saveStateBtn');
    btn.classList.add('loading');
    if (topSaveBtn) { topSaveBtn.disabled = true; topSaveBtn.textContent = 'Сохраняем...'; }
    const data = points.map(p => ({ id: p.id, color: p.color, pts: p.pts, cmd: p.cmd, comm: p.comm }));
    if(await api(`https://api.github.com/gists/${userGistId}`, 'PATCH', { files: { [curFile]: { content: JSON.stringify(data, null, 2) } } })) {
        lastSavedSnapshot = serializePoints();
        btn.classList.remove('loading');
        btn.classList.add('saved');
        if (topSaveBtn) topSaveBtn.textContent = 'Сохранено';
        setTimeout(() => {
            btn.classList.remove('saved');
            if (modalMode === 'list') toggleM('pointsOrderModal');
            updateSaveState();
        }, 900);
    } else {
        btn.classList.remove('loading');
        if (topSaveBtn) { topSaveBtn.disabled = false; topSaveBtn.textContent = 'Ошибка, повторить'; }
    }
}
