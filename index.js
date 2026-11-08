/* ============ INDEXEDDB STORAGE ============ */
const DB = {
  db: null,
  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('PrismDB', 8); // Bumped to v8
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('store')) db.deleteObjectStore('store');
        db.createObjectStore('store');
      };
      req.onsuccess = e => { this.db = e.target.result; resolve(); };
      req.onerror = () => reject();
    });
  },
  async get(key, fallback) {
    return new Promise(resolve => {
      const tx = this.db.transaction('store', 'readonly');
      const req = tx.objectStore('store').get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : fallback);
      req.onerror = () => resolve(fallback);
    });
  },
  async set(key, val) {
    return new Promise(resolve => {
      const tx = this.db.transaction('store', 'readwrite');
      tx.objectStore('store').put(val, key);
      tx.oncomplete = () => resolve();
    });
  }
};

let apps = [];
let settings = { wallpaper: 'alpine', custom: '', dim: 20, engine: 'google' };
let weatherData = null;

/* ============ SEARCH ENGINES ============ */
const ENGINES = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=', domain: 'google.com' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', domain: 'duckduckgo.com' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=', domain: 'bing.com' },
  { id: 'brave', name: 'Brave', url: 'https://search.brave.com/search?q=', domain: 'brave.com' },
  { id: 'ecosia', name: 'Ecosia', url: 'https://www.ecosia.org/search?q=', domain: 'ecosia.org' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=', domain: 'youtube.com' },
  { id: 'wikipedia', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search=', domain: 'wikipedia.org' }
];

/* ============ HELPERS ============ */
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const normalizeUrl = u => { u = (u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u; };
const hostOf = u => { try { return new URL(normalizeUrl(u)).hostname.replace(/^www\./, ''); } catch(e){ return u; } };
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function openApp(url) { window.location.href = normalizeUrl(url); }

function getFavicon(domain, size = 128) { return `https://logo.clearbit.com/${domain}`; }

function createIcon(app, size) {
  const el = document.createElement('div');
  el.className = size === 'large' ? 'app-icon' : 'dock-app';
  const host = hostOf(app.url);
  const img = document.createElement('img');
  img.alt = app.name;
  
  img.onerror = () => {
    img.onerror = () => {
      img.style.display = 'none';
      el.textContent = app.name.charAt(0).toUpperCase();
      el.classList.add('fallback');
    };
    img.src = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  };
  img.src = getFavicon(host, 128);
  el.appendChild(img);
  return el;
}

/* ============ TOAST ============ */
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

/* ============ SEARCH LOGIC ============ */
const searchInput = $('searchInput');
const engineBtn = $('engineBtn');
const engineIcon = $('engineIcon');
const engineDropdown = $('engineDropdown');

function setEngine(id) {
  const eng = ENGINES.find(e => e.id === id) || ENGINES[0];
  settings.engine = eng.id;
  saveSettings();
  
  engineIcon.src = getFavicon(eng.domain, 64);
  engineIcon.onerror = () => {
    engineIcon.onerror = null;
    engineIcon.src = `https://www.google.com/s2/favicons?domain=${eng.domain}&sz=64`;
  };
}

function renderEngineDropdown() {
  engineDropdown.innerHTML = '';
  ENGINES.forEach(eng => {
    const el = document.createElement('div');
    el.className = 'engine-item';
    
    const img = document.createElement('img');
    img.src = getFavicon(eng.domain, 64);
    img.onerror = () => {
      img.onerror = null;
      img.src = `https://www.google.com/s2/favicons?domain=${eng.domain}&sz=64`;
    };
    
    const span = document.createElement('span');
    span.textContent = eng.name;
    
    el.appendChild(img);
    el.appendChild(span);
    
    el.addEventListener('click', () => {
      setEngine(eng.id);
      engineDropdown.classList.remove('open');
      searchInput.focus();
    });
    engineDropdown.appendChild(el);
  });
}

engineBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = engineDropdown.classList.contains('open');
  closeAllPopups();
  if (!isOpen) {
    const rect = engineBtn.getBoundingClientRect();
    engineDropdown.style.top = (rect.bottom + 8) + 'px';
    engineDropdown.style.left = rect.left + 'px';
    engineDropdown.classList.add('open');
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#engineBtn') && !e.target.closest('#engineDropdown')) {
    engineDropdown.classList.remove('open');
  }
});

function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  const eng = ENGINES.find(e => e.id === settings.engine) || ENGINES[0];
  window.location.href = eng.url + encodeURIComponent(q);
}

$('searchSubmit').addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

/* ============ WALLPAPERS ============ */
const WALLPAPERS = [
  { id: 'alpine', name: 'Alpine Dawn', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2560&auto=format&fit=crop' },
  { id: 'forest', name: 'Emerald Mist', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2560&auto=format&fit=crop' },
  { id: 'ocean', name: 'Ocean Dusk', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2560&auto=format&fit=crop' },
  { id: 'sahara', name: 'Sahara Sun', url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?q=80&w=2560&auto=format&fit=crop' },
  { id: 'aurora', name: 'Aurora Night', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=2560&auto=format&fit=crop' },
  { id: 'sakura', name: 'Sakura Ridge', url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=2560&auto=format&fit=crop' },
  { id: 'nebula', name: 'Deep Nebula', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2560&auto=format&fit=crop' },
  { id: 'midnight', name: 'Midnight Dunes', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2560&auto=format&fit=crop' }
];

/* ============ APPLY WALLPAPER ============ */
const wall = $('wall');
function applyWallpaper() {
  if (settings.custom) { wall.style.backgroundImage = `url("${settings.custom}")`; }
  else { 
    const w = WALLPAPERS.find(x => x.id === settings.wallpaper) || WALLPAPERS[0]; 
    wall.style.backgroundImage = `url("${w.url}")`; 
  }
  const b = (1 - settings.dim / 100).toFixed(3);
  const s = (1 + settings.dim / 260).toFixed(3);
  wall.style.filter = `brightness(${b}) saturate(${s})`;
}

let mx = 0, my = 0, px = 0, py = 0;
document.addEventListener('mousemove', e => { mx = (e.clientX / window.innerWidth - 0.5); my = (e.clientY / window.innerHeight - 0.5); });
(function loop(){ px += (mx - px) * 0.06; py += (my - py) * 0.06; wall.style.transform = `translate(${(-px * 20).toFixed(2)}px, ${(-py * 20).toFixed(2)}px) scale(1.04)`; requestAnimationFrame(loop); })();

/* ============ DESKTOP DRAG & DROP ============ */
const desktop = $('desktop');
const emptyState = $('emptyState');
const dockApps = $('dockApps');

function getNextFreeSpot() {
  const CELL_W = 96, CELL_H = 108;
  const startX = 20, startY = 100;
  const maxX = window.innerWidth - 100, maxY = window.innerHeight - 150;

  for (let y = startY; y < maxY; y += CELL_H) {
    for (let x = startX; x < maxX; x += CELL_W) {
      const isOccupied = apps.some(a => Math.abs((a.x || 0) - x) < 10 && Math.abs((a.y || 0) - y) < 10);
      if (!isOccupied) return { x, y };
    }
  }
  return { x: startX, y: startY };
}

function clampAppPositions() {
  let changed = false;
  const maxX = window.innerWidth - 100;
  const maxY = window.innerHeight - 160; 
  
  apps.forEach(a => {
    let nx = Math.min(a.x || 20, maxX);
    let ny = Math.min(a.y || 100, maxY);
    nx = Math.max(20, nx);
    ny = Math.max(100, ny); 
    
    if (nx !== a.x || ny !== a.y) { a.x = nx; a.y = ny; changed = true; }
  });
  
  if (changed) { saveApps(); renderDesktop(); }
}

window.addEventListener('resize', () => {
  clearTimeout(window._resizeTimer);
  window._resizeTimer = setTimeout(clampAppPositions, 150);
});

function renderDesktop() {
  Array.from(desktop.children).forEach(c => { if (c.id !== 'emptyState') c.remove(); });

  apps.forEach(a => {
    const el = document.createElement('div');
    el.className = 'app';
    el.style.left = (a.x || 20) + 'px';
    el.style.top = (a.y || 100) + 'px';

    const icon = createIcon(a, 'large');
    const label = document.createElement('div');
    label.className = 'app-label';
    label.textContent = a.name;
    el.append(icon, label);

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); 
      
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = a.x || 20;
      const origY = a.y || 100;
      let moved = false;

      el.style.zIndex = 1000;
      el.style.cursor = 'grabbing';
      el.style.transition = 'none';

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        if (moved) el.style.transform = `translate(${dx}px, ${dy}px)`;
      };

      const onMouseUp = (upEvent) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        el.style.zIndex = '';
        el.style.cursor = '';
        el.style.transition = '';
        el.style.transform = '';

        if (moved) {
          const dx = upEvent.clientX - startX;
          const dy = upEvent.clientY - startY;
          
          let newX = Math.round((origX + dx) / 96) * 96;
          let newY = Math.round((origY + dy) / 108) * 108;

          newX = Math.max(20, newX);
          newY = Math.max(100, newY);
          newX = Math.min(window.innerWidth - 100, newX);
          newY = Math.min(window.innerHeight - 160, newY);

          a.x = newX;
          a.y = newY;
          
          el.style.left = a.x + 'px';
          el.style.top = a.y + 'px';
          saveApps();
        } else {
          openApp(a.url);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      openCtx(e.clientX, e.clientY, [
        { icon: '↗', label: 'Open', fn: () => openApp(a.url) },
        { icon: '📌', label: a.pinned ? 'Unpin from Dock' : 'Pin to Dock', fn: () => {
          a.pinned = !a.pinned; saveApps(); renderAll(); toast(a.pinned ? 'Pinned to dock' : 'Unpinned');
        }},
        { sep: true },
        { icon: '🗑️', label: 'Uninstall App', danger: true, fn: () => {
          apps = apps.filter(x => x.id !== a.id); saveApps(); renderAll(); toast('Uninstalled ' + a.name);
        }}
      ]);
    });

    desktop.appendChild(el);
  });

  emptyState.style.display = apps.length ? 'none' : 'flex';
}

function renderDock() {
  dockApps.innerHTML = '';
  const pinned = apps.filter(a => a.pinned);

  pinned.forEach(a => {
    const el = document.createElement('div');
    el.className = 'dock-app';
    el.title = a.name;
    el.appendChild(createIcon(a, 'small'));
    el.addEventListener('click', () => openApp(a.url));
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      openCtx(e.clientX, e.clientY, [
        { icon: '↗', label: 'Open', fn: () => openApp(a.url) },
        { icon: '📌', label: 'Unpin from Dock', fn: () => {
          a.pinned = false; saveApps(); renderAll(); toast('Unpinned from dock');
        }},
        { icon: '🗑️', label: 'Uninstall App', danger: true, fn: () => {
          apps = apps.filter(x => x.id !== a.id); saveApps(); renderAll(); toast('Uninstalled ' + a.name);
        }}
      ]);
    });
    dockApps.appendChild(el);
  });

  const has = pinned.length > 0;
  dockApps.style.display = has ? 'flex' : 'none';
  $('dockDiv1').style.display = has ? '' : 'none';
}

function renderAll() { renderDesktop(); renderDock(); }

/* ============ CLOCK & CALENDAR ============ */
function tickClock() { $('dockTime').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
setInterval(tickClock, 1000); tickClock();

function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  $('clockDate').textContent = `${monthNames[month]} ${year}`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `<div class="cal-header"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div><div class="cal-grid">`;
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === today ? 'today' : '';
    html += `<div class="cal-day ${isToday}">${i}</div>`;
  }
  html += `</div>`;
  $('calendarGrid').innerHTML = html;
}

/* ============ WEATHER ============ */
const WMO = {
  0:['☀️','Clear'],1:['🌤️','Mainly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],
  45:['🌫️','Fog'],48:['🌫️','Rime fog'],51:['🌦️','Light drizzle'],53:['🌦️','Drizzle'],55:['🌧️','Dense drizzle'],
  61:['🌧️','Light rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],71:['🌨️','Light snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],
  80:['🌦️','Rain showers'],81:['🌧️','Showers'],82:['⛈️','Violent showers'],95:['⛈️','Thunderstorm']
};

async function fetchWeather(lat, lon, cityName) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
    const d = await r.json();
    weatherData = d;
    weatherData.cityName = cityName;
    renderWeather();
  } catch(e) { console.error("Weather error", e); }
}

function renderWeather() {
  if (!weatherData) return;
  const cur = weatherData.current;
  const [ic, desc] = WMO[cur.weather_code] || ['🌡️','—'];
  const t = Math.round(cur.temperature_2m);

  $('dockWIco').textContent = ic;
  $('dockWTemp').textContent = t + '°';

  $('wpCity').textContent = weatherData.cityName || 'Local';
  $('wpTemp').textContent = t + '°';
  $('wpDesc').textContent = desc;
  $('wpIcon').textContent = ic;
  $('wpFeels').textContent = Math.round(cur.apparent_temperature) + '°';
  $('wpHum').textContent = cur.relative_humidity_2m + '%';
  $('wpWind').textContent = Math.round(cur.wind_speed_10m) + ' km/h';

  let fHtml = '';
  if (weatherData.daily) {
    for (let i = 1; i <= 4; i++) {
      const date = new Date(weatherData.daily.time[i] + 'T12:00:00');
      const dayName = date.toLocaleDateString([], { weekday: 'short' });
      const [fIc] = WMO[weatherData.daily.weather_code[i]] || ['🌡️'];
      const hi = Math.round(weatherData.daily.temperature_2m_max[i]);
      const lo = Math.round(weatherData.daily.temperature_2m_min[i]);
      fHtml += `<div class="forecast-day"><div class="fd-name">${dayName}</div><div class="fd-ico">${fIc}</div><div class="fd-temp"><b>${hi}°</b> <span>${lo}°</span></div></div>`;
    }
  }
  $('wpForecast').innerHTML = fHtml;
}

function initWeather() {
  if (!navigator.geolocation) { fetchWeather(51.5074, -0.1278, 'London'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Local'),
    err => fetchWeather(51.5074, -0.1278, 'London'),
    { timeout: 5000 }
  );
}

/* ============ CONTEXT MENU & POPUPS ============ */
const ctxMenu = $('ctxMenu');

function openCtx(x, y, items) {
  ctxMenu.innerHTML = '';
  items.forEach(it => {
    if (it.sep) {
      const s = document.createElement('div'); s.className = 'ctx-sep'; ctxMenu.appendChild(s); return;
    }
    const el = document.createElement('div');
    el.className = 'ctx-item' + (it.danger ? ' danger' : '');
    el.innerHTML = `<span>${it.icon || ''}</span><span>${escapeHTML(it.label)}</span>`;
    el.addEventListener('click', () => { closeCtx(); it.fn(); });
    ctxMenu.appendChild(el);
  });
  ctxMenu.classList.add('open');
  const w = ctxMenu.offsetWidth, h = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
  ctxMenu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
}
function closeCtx() { ctxMenu.classList.remove('open'); }

document.addEventListener('contextmenu', e => {
  if (e.target.closest('#ctxMenu, #dock, .overlay, .app, #searchContainer, #engineDropdown')) return;
  e.preventDefault();
  openCtx(e.clientX, e.clientY, [
    { icon: '🛍️', label: 'App Store', fn: openStore },
    { icon: '⚙️', label: 'Settings', fn: openSettings },
    { icon: '🖼️', label: 'Change Wallpaper', fn: openSettings },
    { sep: true },
    { icon: '🔄', label: 'Refresh', fn: () => location.reload() }
  ]);
});

document.addEventListener('click', e => {
  if (!e.target.closest('#ctxMenu')) closeCtx();
  if (!e.target.closest('#clockPopup') && !e.target.closest('#dockTime') && !e.target.closest('#weatherPopup') && !e.target.closest('#dockWeather')) {
    closeAllPopups();
  }
});

function closeAllPopups() {
  $('clockPopup').classList.remove('open');
  $('weatherPopup').classList.remove('open');
  engineDropdown.classList.remove('open');
}

$('dockTime').addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = $('clockPopup').classList.contains('open');
  closeAllPopups();
  if (!isOpen) { renderCalendar(); $('clockPopup').classList.add('open'); }
});

$('dockWeather').addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = $('weatherPopup').classList.contains('open');
  closeAllPopups();
  if (!isOpen) $('weatherPopup').classList.add('open');
});

/* ============ APP STORE & SETTINGS ============ */
const storeModal = $('storeModal');
const settingsModal = $('settingsModal');

function openStore() {
  $('storeName').value = '';
  $('storeUrl').value = '';
  storeModal.classList.add('open');
  setTimeout(() => $('storeName').focus(), 150);
}

$('storeAdd').addEventListener('click', () => {
  const name = $('storeName').value.trim();
  const url = normalizeUrl($('storeUrl').value);
  if (!name || !url) { toast('Name and URL are required'); return; }
  if (apps.some(a => a.url === url)) { toast('Already installed'); return; }
  
  const pos = getNextFreeSpot();
  apps.push({ id: uid(), name, url, pinned: false, x: pos.x, y: pos.y });
  
  saveApps(); renderAll();
  storeModal.classList.remove('open');
  toast(name + ' installed');
});

$('storeUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('storeAdd').click(); });

const wallGrid = $('wallGrid');
const dimRange = $('dimRange');

function renderWallGrid() {
  wallGrid.innerHTML = '';
  WALLPAPERS.forEach(w => {
    const t = document.createElement('div');
    t.className = 'thumb' + (!settings.custom && settings.wallpaper === w.id ? ' active' : '');
    t.style.backgroundImage = `url("${w.url}")`;
    const s = document.createElement('span'); s.textContent = w.name; t.appendChild(s);
    t.addEventListener('click', () => {
      settings.wallpaper = w.id; settings.custom = '';
      saveSettings(); applyWallpaper(); renderWallGrid();
      toast(w.name + ' applied');
    });
    wallGrid.appendChild(t);
  });
}

function openSettings() {
  renderWallGrid();
  dimRange.value = settings.dim;
  $('wallUrl').value = settings.custom && settings.custom.startsWith('data:') ? '' : (settings.custom || '');
  settingsModal.classList.add('open');
}

dimRange.addEventListener('input', () => {
  settings.dim = Number(dimRange.value);
  saveSettings(); applyWallpaper();
});

$('wallUrlSet').addEventListener('click', () => {
  const u = $('wallUrl').value.trim();
  if (!u) { toast('Paste an image URL first'); return; }
  settings.custom = u; saveSettings(); applyWallpaper(); renderWallGrid();
  toast('Custom wallpaper applied');
});

$('wallFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    settings.custom = ev.target.result;
    saveSettings(); applyWallpaper(); renderWallGrid();
    toast('Custom wallpaper applied');
  };
  reader.readAsDataURL(file);
});

document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => b.closest('.overlay').classList.remove('open'));
});
[storeModal, settingsModal].forEach(m => {
  m.addEventListener('mousedown', e => { if (e.target === m) m.classList.remove('open'); });
});

$('storeBtn').addEventListener('click', openStore);
$('settingsBtn').addEventListener('click', openSettings);
$('emptyStoreBtn').addEventListener('click', openStore);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCtx(); closeAllPopups(); storeModal.classList.remove('open'); settingsModal.classList.remove('open'); }
  if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); openSettings(); }
});

/* ============ DATA SYNC & BOOT ============ */
async function saveApps() { await DB.set('prism_apps', apps); }
async function saveSettings() { await DB.set('prism_settings', settings); }

async function boot() {
  await DB.init();
  
  const storedApps = await DB.get('prism_apps', null);
  if (!storedApps) {
    apps = [];
    await saveApps();
  } else {
    apps = storedApps.filter(a => a.url && !a.url.startsWith('app://'));
    
    let changed = false;
    apps.forEach(a => {
      if (a.x === undefined || a.y === undefined) {
        const pos = getNextFreeSpot();
        a.x = pos.x;
        a.y = pos.y;
        changed = true;
      }
    });
    if (changed) await saveApps();
  }

  const storedSettings = await DB.get('prism_settings', null);
  if (storedSettings) {
    settings = Object.assign(settings, storedSettings);
  } else {
    await saveSettings();
  }

  setEngine(settings.engine);
  renderEngineDropdown();
  applyWallpaper();
  renderAll();
  initWeather();
}

boot();
