const { byId, getTelegramWebApp, getTelegramUser } = window.AppShared;
const CFG = { 
    GITHUB_USER: "yvayvapyvapyva", 
    CACHE_NAME: "route-audio-v1",
    TRIGGER_DIST: 25, 
    AZ_TOLERANCE: 45, 
    SPEED_THRESHOLD: 2, 
    DEFAULT_CENTER: [56.3268, 44.0059], 
    COLORS: { Gold:'#FFD700', Blue:'#007AFF', Red:'#FF3B30', Lime:'#34C759', Fuchsia:'#AF52DE', Orange:'#FF9500', Purple:'#5856D6', Cyan:'#5AC8FA', Brown:'#A2845E', Grey:'#8E8E93' } 
};

const audioEngine = new Audio();
document.getElementById('cfgTrigger').addEventListener('input', (e) => { CFG.TRIGGER_DIST = Number(e.target.value); });
document.getElementById('cfgSpeed').addEventListener('input', (e) => { CFG.SPEED_THRESHOLD = Number(e.target.value); });
document.getElementById('cfgAz').addEventListener('input', (e) => { CFG.AZ_TOLERANCE = Number(e.target.value); });

let tgUser = null, startParam = null;
const tg = getTelegramWebApp();
if (tg) {
    tg.expand();
    tg.ready();
    if (tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
    }
    tgUser = getTelegramUser();
    startParam = tg.initDataUnsafe?.start_param;
}

const urlParams = new URLSearchParams(window.location.search);
if (!startParam) startParam = urlParams.get('route') || urlParams.get('startapp');
const goHome = () => {
    const t = urlParams.get('t');
    const url = new URL('index.html', window.location.href);
    if (t) url.searchParams.set('t', t);
    window.location.href = url.toString();
};

const v = document.getElementById('v');
let wl = null, map, userMarker, pointsCollection, linesCollection, pointsData=[], currentIndex=-1, previewIndex=-1, autoCenter=false, lastPos=null, lastAz=0, currentSpeed=0, iconCache = new Map();
let wakeWanted = false;
const REPORT_CFG = {
    BOT_TOKEN: '7860806384:AAEYRKqdPUsUz9npN3MmyEYKH-rTHISeHbs',
    CHAT_ID: '5180466640'
};

const wake = async () => {
    if (audioEngine.paused) {
        audioEngine.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
        audioEngine.play().catch(() => {});
    }
    if (wl) { try { await wl.release(); } catch(e) {} wl = null; }
    if ('wakeLock' in navigator) {
        try {
            wl = await navigator.wakeLock.request('screen');
            wakeWanted = true;
            hideWakeOverlay();
        } catch(e) {
            if (wakeWanted) showWakeOverlay();
        }
    } else if (wakeWanted) {
        showWakeOverlay();
    }
    if (!v.src) v.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21hdmMxbXA0MgAAAAhmcmVlAAAALm1kYXQAAAHvYXZjQwFQAFr/4AAZAWgAVv/AAB9AAAADAAIAAAMAHBDeEAEABWj/gAAAAA5ieHRyY3Rsc3RyYmMAAAALYm9vdnNoZHIAAAADbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAPoAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACAGlzb21hdmMxbXA0MgAAAAhmcmVlAAAALm1kYXQ=";
    v.play().catch(()=>{});
};
const wakeFromUser = () => {
    wakeWanted = true;
    wake();
};
['touchstart', 'click'].forEach(e => document.addEventListener(e, wakeFromUser));

const wakeOverlay = document.getElementById('wakeOverlay');
const wakeBtn = document.getElementById('wakeBtn');
const showWakeOverlay = () => { if (wakeOverlay) wakeOverlay.style.display = 'flex'; };
const hideWakeOverlay = () => { if (wakeOverlay) wakeOverlay.style.display = 'none'; };
if (wakeBtn) wakeBtn.addEventListener('click', wakeFromUser);

const tryRestoreWake = () => {
    showWakeOverlay();
    if (wakeWanted) wake();
};

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tryRestoreWake();
});
window.addEventListener('focus', () => {
    tryRestoreWake();
});

showWakeOverlay();

/**
 * Нормализация имени файла: NFC, нижний регистр, удаление спецсимволов, замена пробелов на подчеркивание
 */
function getAudioPath(text) {
    if (!text) return null;
    const normalized = text.normalize('NFC')
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-`~()]/g, "")
        .trim()
        .replace(/\s+/g, '_');
    return `audio/${encodeURIComponent(normalized)}.mp3`;
}

/**
 * Предзагрузка всех аудио в кэш браузера
 */
async function preloadAudio(data) {
    if (!('caches' in window)) return;
    const cache = await caches.open(CFG.CACHE_NAME);
    const uniquePaths = [...new Set(data.map(p => getAudioPath(p.cmd)).filter(p => p))];
    let loaded = 0;
    
    ui('cacheStatus').style.display = 'block';
    ui('cacheStatus').innerText = `Кэширование: 0%`;

    for (const path of uniquePaths) {
        try {
            const response = await fetch(path);
            if (response.ok) {
                await cache.put(path, response);
            }
        } catch (e) {
            console.warn("Failed to cache:", path);
        }
        loaded++;
        ui('cacheStatus').innerText = `Кэширование: ${Math.round((loaded / uniquePaths.length) * 100)}%`;
    }
    
    setTimeout(() => {
        ui('cacheStatus').innerText = "Готов к офлайну";
        setTimeout(() => ui('cacheStatus').style.display = 'none', 3000);
    }, 1000);
}

/**
 * Воспроизведение команды (сначала проверяет кэш)
 */
async function playCommand(text) {
    const path = getAudioPath(text);
    if (!path) return;

    audioEngine.pause();

    // Пытаемся взять из кэша для мгновенного доступа
    if ('caches' in window) {
        const cache = await caches.open(CFG.CACHE_NAME);
        const cachedResponse = await cache.match(path);
        if (cachedResponse) {
            const blob = await cachedResponse.blob();
            audioEngine.src = URL.createObjectURL(blob);
            audioEngine.play().catch(e => console.error("Cached play error", e));
            return;
        }
    }

    // Если в кэше нет, играем по сети
    audioEngine.src = path;
    audioEngine.play().catch((err) => console.warn("Network audio play failed:", path));
}

const ui = byId;
const calcAz = (p1, p2) => {
    if(!p1 || !p2) return 0;
    const [la1, lo1] = p1.map(v => v * Math.PI/180), [la2, lo2] = p2.map(v => v * Math.PI/180);
    const y = Math.sin(lo2-lo1) * Math.cos(la2), x = Math.cos(la1)*Math.sin(la2) - Math.sin(la1)*Math.cos(la2)*Math.cos(lo2-lo1);
    return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
};

const getIcon = (col, txt, az, isEnd, isCurr=false, hasComm=false) => {
    const key = `${col}-${txt}-${az}-${isEnd}-${isCurr}-${hasComm}`;
    if (iconCache.has(key)) return iconCache.get(key);
    const s=isEnd?34:40, c=s/2, t=txt.replace('!','');
    let strk = '#000000', strkWidth = 1.5;
    
    if (isCurr && !isEnd) { 
        strk = '#00FF00'; 
        strkWidth = 2.0; 
    } else if (isEnd) { 
        strk = '#FFFFFF'; 
    }
    
    const textColor = hasComm ? '#FF9500' : '#000000';
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g transform="rotate(${az},${c},${c})"><polygon points="${c},2 ${c+10},${s-5} ${c},${s-14} ${c-10},${s-5}" fill="${col}" stroke="${strk}" stroke-width="${strkWidth}"/></g><circle cx="${c}" cy="${c}" r="${isEnd?7:9}" fill="${col}" stroke="${strk}" stroke-width="${strkWidth}"/><text x="${c}" y="${c+0.5}" font-size="${isEnd?8:9}" font-family="Arial" font-weight="900" text-anchor="middle" dominant-baseline="middle" fill="${textColor}" stroke="white" stroke-width="2" style="paint-order:stroke fill">${t}</text></svg>`;
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    iconCache.set(key, dataUrl);
    return dataUrl;
};

ymaps.ready(() => {
    map = new ymaps.Map("map", { center: CFG.DEFAULT_CENTER, zoom: 15, type: 'yandex#satellite', controls: [] });
    pointsCollection = new ymaps.GeoObjectCollection();
    linesCollection = new ymaps.GeoObjectCollection();
    map.geoObjects.add(linesCollection).add(pointsCollection);
    userMarker = new ymaps.Placemark(CFG.DEFAULT_CENTER, {}, { iconLayout:'default#image', iconImageSize:[40,40], iconImageOffset:[-20,-20], zIndex: 2000 });
    map.geoObjects.add(userMarker);

    navigator.geolocation.watchPosition(p => {
        const c = [p.coords.latitude, p.coords.longitude];
        currentSpeed = (p.coords.speed || 0)*3.6;
        if(currentSpeed >= CFG.SPEED_THRESHOLD) lastAz = p.coords.heading ?? (lastPos ? calcAz(lastPos, c) : lastAz);
        lastPos = c; userMarker.geometry.setCoordinates(c);
        userMarker.options.set('iconImageHref', `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><g transform="rotate(${lastAz},20,20)"><path d="M20,4 L32,34 L20,28 L8,34 Z" fill="#FF3B30" stroke="white" stroke-width="2"/></g></svg>`)}`);
        ui('telSpeed').innerText = Math.round(currentSpeed); ui('telAz').innerText = `${Math.round(lastAz)}°`;
        if(autoCenter) map.panTo(c);
        checkNav();
    }, null, {enableHighAccuracy:true});

    map.events.add('click', () => { closeSelection(); togglePointsMenu(false); toggleSettings(false); toggleGistInfo(false); ui('commentOverlay').style.display = 'none'; });
    
    if (!startParam) {
        showError("ПАРАМЕТР МАРШРУТА ОТСУТСТВУЕТ");
    } else {
        fetchSpecificRoute(startParam);
    }
});

function showError(msg) {
    ui('loadingText').style.display = 'none';
    ui('errorMsg').style.display = 'block';
    ui('errorMsg').innerText = msg;
    ui('routeHeaderBtn').innerText = "ОШИБКА";
}

const closeSelection = () => { 
    ui('selectionHud').classList.remove('active'); 
    previewIndex = -1; 
    if(currentIndex>=0) { ui('navHud').classList.add('active'); refreshMap(); }
};

async function fetchSpecificRoute(param) {
    const parts = param.split('-');
    if (parts.length < 2) {
        showError("НЕВЕРНЫЙ ФОРМАТ ПАРАМЕТРА");
        return;
    }
    const targetId = parts[0].trim();
    const cleanFileName = parts.slice(1).join('-').trim();
    const targetFileName = cleanFileName + ".json";

    ui('routeHeaderBtn').innerText = "ПОИСК GIST...";
    try {
        const res = await fetch(`https://api.github.com/users/${CFG.GITHUB_USER}/gists?per_page=100`), data = await res.json();
        const targetGist = data.find(g => g.description && g.description.includes(`[${targetId}]`));
        if (targetGist) {
            const fileObj = Object.values(targetGist.files).find(f => f.filename.toLowerCase() === targetFileName.toLowerCase());
            if (fileObj) {
                ui('gistDesc').innerText = targetGist.description || "Описание отсутствует";
                loadData(fileObj.raw_url, cleanFileName);
            } else {
                showError(`ФАЙЛ "${targetFileName}" НЕ НАЙДЕН`);
            }
        } else {
            showError(`GIST "${targetId}" НЕ НАЙДЕН`);
        }
    } catch(e) { showError("ОШИБКА GITHUB"); }
}

async function loadData(url, name) {
    iconCache.clear();
    try {
        const res = await fetch(url), raw = await res.json();
        pointsData = raw.map((d, i) => {
            const pts = d.pts || [];
            return {
                id: d.id, lat: pts[0]?.[0], lon: pts[0]?.[1], color: d.color, hex: CFG.COLORS[d.color] || '#007AFF',
                cmd: (d.cmd || d.comm || `Т${d.id}`).trim(), 
                comm: d.comm || "",
                pts: pts, az: pts.length>=2 ? calcAz(pts[0], pts[1]) : 0
            };
        });
        
        // Запускаем предзагрузку аудио сразу после парсинга данных
        preloadAudio(pointsData);

        currentIndex = 0; previewIndex = -1; 
        ui('routeHeaderBtn').innerText = name.toUpperCase();
        refreshMap();
        if(pointsData.length) {
            const bounds = pointsCollection.getBounds();
            if(bounds) map.setBounds(bounds, {zoomMargin:60});
        }
        ui('navHud').classList.add('active');
        ui('loading').classList.add('hidden');
        if (window.TelegramTimeReport && window.TelegramTimeReport.sendRouteLaunchReport) {
            const userName = tgUser ? `${tgUser.first_name || ''}${tgUser.last_name ? ` ${tgUser.last_name}` : ''}`.trim() : 'Unknown';
            const username = tgUser && tgUser.username ? `@${tgUser.username}` : '@none';
            window.TelegramTimeReport.sendRouteLaunchReport(
                REPORT_CFG.BOT_TOKEN,
                REPORT_CFG.CHAT_ID,
                { routeName: name, userName, username, source: 'navigator', telegramWebApp: tg }
            );
        }
    } catch(e) { showError("ОШИБКА ДАННЫХ"); }
}

function refreshMap() {
    pointsCollection.removeAll(); linesCollection.removeAll();
    if(currentIndex < 0 || currentIndex >= pointsData.length) return;
    pointsData.forEach((p, i) => {
        if(i < currentIndex) return; 
        const isCurrent = (i === currentIndex), isPreview = (i === previewIndex);
        const hasComm = p.comm && p.comm.trim() !== "";
        const placemark = new ymaps.Placemark([p.lat, p.lon], {}, {
            iconLayout: 'default#image',
            iconImageHref: getIcon(p.hex, String(p.id), p.az, false, isCurrent, hasComm),
            iconImageSize: [40, 40],
            iconImageOffset: [-20, -20],
            zIndex: (isCurrent || isPreview) ? 1000 : 500
        });
        placemark.events.add('click', e => {
            if (i === currentIndex) return;
            previewIndex = i;
            ui('navHud').classList.remove('active'); 
            ui('selectionHud').classList.add('active');
            ui('selIndex').innerText = i + 1; 
            ui('selCmd').innerText = p.cmd;
            ui('selConfirmBtn').onclick = () => { setTarget(i); closeSelection(); };
            ui('selSpeakBtn').onclick = (ev) => { ev.stopPropagation(); playCommand(p.cmd); };
            if (hasComm) {
                ui('selCommentBtn').style.display = 'flex';
                ui('selCommentBtn').onclick = (ev) => { ev.stopPropagation(); showComment(p.comm, false); };
            } else {
                ui('selCommentBtn').style.display = 'none';
            }
            refreshMap();
        });
        pointsCollection.add(placemark);
        if (isCurrent && p.pts && p.pts.length >= 2) drawPath(p, false, hasComm);
        if (isPreview && p.pts && p.pts.length >= 2) drawPath(p, true, hasComm);
    });
    renderList(); updateHUD();
}

function showComment(txt, shouldCloseList = true) {
    ui('commentText').innerText = txt;
    ui('commentOverlay').style.display = 'flex';
}

function drawPath(p, isPreview, hasComm) {
    const isCurrent = !isPreview;
    const opacity = isPreview ? 0.6 : 1.0, width = isPreview ? 3 : 4, color = p.hex;
    linesCollection.add(new ymaps.Polyline(p.pts, {}, {
        strokeColor: color, strokeWidth: width, strokeOpacity: opacity, 
        outline: true, outlineColor: '#000000', outlineWidth: 1.5
    }));
    const last = p.pts[p.pts.length-1], prev = p.pts[p.pts.length-2];
    linesCollection.add(new ymaps.Placemark(last, {}, { 
        iconLayout: 'default#image', iconImageSize: [34, 34], iconImageOffset: [-17, -17], 
        iconImageHref: getIcon(p.hex, String(p.id), calcAz(prev, last), true, isCurrent, hasComm),
        opacity: opacity, zIndex: isPreview ? 900 : 950
    }));
}

function checkNav() {
    if(currentIndex<0 || !lastPos || !pointsData[currentIndex]) return;
    const t = pointsData[currentIndex], d = ymaps.coordSystem.geo.getDistance(lastPos, [t.lat, t.lon]);
    let ad = Math.abs(lastAz - t.az) % 360; if(ad > 180) ad = 360 - ad;
    updateHUD(d, ad);
    if(d <= CFG.TRIGGER_DIST && ad <= CFG.AZ_TOLERANCE) { 
        playCommand(t.cmd); 
        currentIndex++; 
        previewIndex = -1; 
        if(currentIndex < pointsData.length) { refreshMap(); } else { ui('hudCmd').innerText = "ФИНИШ"; refreshMap(); }
    }
}

function updateHUD(d, ad) {
    const t = pointsData[currentIndex]; if(!t) return;
    ui('hudIndex').innerText = currentIndex + 1; ui('hudCmd').innerText = t.cmd; ui('hudTargetAz').innerText = `${Math.round(t.az)}°`;
    const hasComm = t.comm && t.comm.trim() !== "";
    if (hasComm) {
        ui('navCommentBtn').style.display = 'flex';
        ui('navCommentBtn').onclick = (ev) => { ev.stopPropagation(); showComment(t.comm, false); };
    } else {
        ui('navCommentBtn').style.display = 'none';
    }
    ui('navSpeakBtn').onclick = (ev) => { ev.stopPropagation(); playCommand(t.cmd); };
    if(d !== undefined) {
        ui('hudDist').innerText = `${Math.round(d)}м`;
        ui('hudDist').classList.toggle('in-range', d <= CFG.TRIGGER_DIST);
        ui('hudTargetAz').classList.toggle('in-range', ad <= CFG.AZ_TOLERANCE);
    }
}

function renderList() {
    ui('pointsList').innerHTML = pointsData.map((p, i) => {
        const hasComm = p.comm && p.comm.trim() !== "";
        return `
        <div class="point-item ${i===currentIndex?'active':''}" onclick="setTarget(${i});togglePointsMenu(false);">
            <div class="point-badge" style="${i===currentIndex?'background:#00FF00;color:black':''}">${i+1}</div>
            <div class="point-content">
                <div class="point-name">${p.cmd}</div>
            </div>
            <div class="point-actions">
                ${hasComm ? `
                <button class="action-icon-btn comm-btn" onclick="event.stopPropagation(); showComment('${p.comm.replace(/'/g, "\\'")}', false);">
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                </button>` : ''}
                <button class="action-icon-btn" onclick="event.stopPropagation(); playCommand('${p.cmd.replace(/'/g, "\\'")}');">
                    <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                </button>
            </div>
        </div>`;
    }).join('');
}

const setTarget = idx => { currentIndex=idx; previewIndex=-1; refreshMap(); wake(); };
const togglePointsMenu = s => { ui('pointsMenu').style.display = (s ?? ui('pointsMenu').style.display!=='flex') ? 'flex' : 'none'; if(ui('pointsMenu').style.display==='flex') { toggleSettings(false); toggleGistInfo(false); ui('commentOverlay').style.display = 'none'; } };
const toggleSettings = s => { ui('settingsOverlay').style.display = (s ?? ui('settingsOverlay').style.display!=='flex') ? 'flex' : 'none'; if(ui('settingsOverlay').style.display==='flex') { togglePointsMenu(false); toggleGistInfo(false); ui('commentOverlay').style.display = 'none'; } };
const toggleGistInfo = s => { ui('gistInfoOverlay').style.display = (s ?? ui('gistInfoOverlay').style.display!=='flex') ? 'flex' : 'none'; if(ui('gistInfoOverlay').style.display==='flex') { togglePointsMenu(false); toggleSettings(false); ui('commentOverlay').style.display = 'none'; } };
