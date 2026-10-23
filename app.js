(function () {
  'use strict';

  var STORE_KEY = 'pixelhome.v1';
  var HUES = [250, 200, 160, 120, 40, 10, 330, 290];
  var ICONS = ['ps5', 'switch2', 'hdmi', 'tv', 'game', 'play', 'music', 'grid', 'star'];

  var DEFAULTS = {
    city: { name: 'Cordoba, AR', lat: -31.4135, lon: -64.181 },
    inputs: [
      { id: 'hdmi1', name: 'PS5', sub: 'HDMI 1', hue: 210, icon: 'ps5', logo: 'playstation', color: '#2f8cff', port: 1, hidden: false },
      { id: 'hdmi2', name: 'Switch 2', sub: 'HDMI 2', hue: 350, icon: 'switch2', logo: 'nintendoswitch', color: '#ff3b4a', port: 2, hidden: false },
      { id: 'hdmi3', name: 'HDMI 3', sub: 'Entrada', hue: 120, icon: 'hdmi', port: 3, hidden: false },
      { id: 'hdmi4', name: 'HDMI 4', sub: 'Entrada', hue: 40, icon: 'hdmi', port: 4, hidden: true }
    ],
    apps: [
      { id: 'netflix', name: 'Netflix', appId: '3201907018807', hue: 355, icon: 'play', logo: 'netflix', color: '#e50914', hidden: false },
      { id: 'youtube', name: 'YouTube', appId: '111299001912', hue: 0, icon: 'play', logo: 'youtube', color: '#ff0000', hidden: false },
      { id: 'prime', name: 'Prime Video', appId: '3201910019365', hue: 200, icon: 'play', logo: 'primevideo', color: '#1a98ff', hidden: false },
      { id: 'disney', name: 'Disney+', appId: '3201901017640', hue: 225, icon: 'star', img: 'img/disneyplus.webp', hidden: false },
      { id: 'spotify', name: 'Spotify', appId: '3201606009684', hue: 140, icon: 'music', logo: 'spotify', color: '#1db954', hidden: false }
    ]
  };

  var state = load();
  var hasTizen = typeof window.tizen !== 'undefined';

  /* ---------- storage ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return clone(DEFAULTS);
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function drawSprite(canvas, rows, hue, fixedPal) {
    var h = rows.length, w = rows[0].length;
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    var pal = fixedPal || {
      '1': '#f2f2ff',
      '2': 'hsl(' + hue + ',75%,62%)',
      '3': 'hsl(' + hue + ',45%,38%)',
      '4': '#12121c', '5': '#4fa3ff', '6': '#00c3e3', '7': '#ff4554', '8': '#2b2b3a', '9': '#26304f'
    };
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var c = rows[y].charAt(x);
        if (c !== '.' && pal[c]) { ctx.fillStyle = pal[c]; ctx.fillRect(x, y, 1, 1); }
      }
    }
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, 3500);
  }

  /* ---------- scaling ---------- */
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var st = $('stage');
    st.style.transform = 'scale(' + s + ')';
    st.style.left = Math.max(0, (window.innerWidth - 1920 * s) / 2) + 'px';
    st.style.top = Math.max(0, (window.innerHeight - 1080 * s) / 2) + 'px';
  }
  window.addEventListener('resize', fit);

  /* ---------- clock ---------- */
  var DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function tick() {
    var d = new Date();
    $('hh').textContent = pad(d.getHours());
    $('mm').textContent = pad(d.getMinutes());
    $('date').textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
  }

  /* ---------- weather (Open-Meteo, no key) ---------- */
  var WX = {
    kind: function (c) {
      if (c === 0) return ['sun', 'Despejado'];
      if (c <= 2) return ['partly', 'Parcialmente nublado'];
      if (c === 3) return ['cloud', 'Nublado'];
      if (c === 45 || c === 48) return ['fog', 'Niebla'];
      if (c >= 51 && c <= 67) return ['rain', 'Lluvia'];
      if (c >= 71 && c <= 77) return ['snow', 'Nieve'];
      if (c >= 80 && c <= 82) return ['rain', 'Chubascos'];
      if (c >= 95) return ['storm', 'Tormenta'];
      return ['cloud', 'Variable'];
    }
  };
  function showWeather(w) {
    var k = WX.kind(w.code);
    var spr = WEATHER_SPRITES[k[0]];
    drawSprite($('wicon'), spr.rows, 0, spr.pal);
    $('wtemp').textContent = Math.round(w.temp) + '°';
    $('wdesc').textContent = k[1] + '  ' + Math.round(w.min) + '°/' + Math.round(w.max) + '°';
    $('wcity').textContent = state.city.name;
  }
  function loadWeather() {
    var c = state.city;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min' +
      '&timezone=auto&forecast_days=1';
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('pixelhome.wx')); } catch (e) {}
    if (cached) showWeather(cached);
    var x = new XMLHttpRequest();
    x.open('GET', url);
    x.timeout = 15000;
    x.onload = function () {
      try {
        var j = JSON.parse(x.responseText);
        var w = {
          temp: j.current.temperature_2m, code: j.current.weather_code,
          min: j.daily.temperature_2m_min[0], max: j.daily.temperature_2m_max[0]
        };
        try { localStorage.setItem('pixelhome.wx', JSON.stringify(w)); } catch (e) {}
        showWeather(w);
      } catch (e) { if (!cached) $('wdesc').textContent = 'Sin datos de clima'; }
    };
    x.onerror = x.ontimeout = function () { if (!cached) $('wdesc').textContent = 'Sin conexion'; };
    x.send();
  }

  /* ---------- home rendering / focus ---------- */
  var rows = [[], []];            // rendered card descriptors per row
  var focus = { row: 0, col: 0 };

  function cardEl(item, kind) {
    var c = el('div', 'card');
    var hue = item.hue == null ? 250 : item.hue;
    c.style.setProperty('--c-edge', 'hsl(' + hue + ',65%,52%)');
    c.style.setProperty('--c-dim', 'hsl(' + hue + ',25%,62%)');
    var art = el('div', 'art');
    var cv = el('canvas');
    drawSprite(cv, SPRITES[item.icon] || SPRITES.grid, hue);
    art.appendChild(cv);
    if (item.img) {
      var pic = new Image();
      pic.className = 'logo';
      pic.onload = function () { if (cv.parentNode === art) art.replaceChild(pic, cv); };
      pic.src = item.img;
    } else if (item.logo) loadBrand(item, art, cv);
    else if (kind === 'app' && item.appId) loadLogo(item, art, cv);
    var txt = el('div');
    var n = el('div', 'name'); n.textContent = item.name;
    txt.appendChild(n);
    if (kind === 'input') { var s = el('div', 'sub'); s.textContent = item.sub || ''; txt.appendChild(s); }
    var cur = el('canvas', 'cursor');
    drawSprite(cur, SPRITES.sword, 0, SWORD_PAL);
    c.appendChild(cur); c.appendChild(art); c.appendChild(txt);
    return c;
  }

  // Official brand mark (Simple Icons), tinted with the brand colour; sprite stays if offline.
  var ICON_CDN = 'https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/';
  function loadBrand(item, holder, fallback) {
    var key = 'pixelhome.svg.' + item.logo;
    function show(svg) {
      var m = el('div', 'brand');
      m.style.color = item.color || '#fff';
      m.innerHTML = svg;
      if (fallback.parentNode === holder) holder.replaceChild(m, fallback);
    }
    var cached = null;
    try { cached = localStorage.getItem(key); } catch (e) {}
    if (cached) return show(cached);
    var x = new XMLHttpRequest();
    x.open('GET', ICON_CDN + item.logo + '.svg');
    x.timeout = 15000;
    x.onload = function () {
      if (x.status !== 200 || x.responseText.indexOf('<svg') < 0) { if (item.appId) loadLogo(item, holder, fallback); return; }
      try { localStorage.setItem(key, x.responseText); } catch (e) {}
      show(x.responseText);
    };
    x.onerror = x.ontimeout = function () { if (item.appId) loadLogo(item, holder, fallback); };
    x.send();
  }

  // Use the app's own icon from the TV (not redrawn); sprite stays as fallback.
  function loadLogo(item, holder, fallback) {
    if (!hasTizen || !tizen.application || !tizen.application.getAppInfo) return;
    try {
      tizen.application.getAppInfo(item.appId, function (info) {
        if (!info || !info.iconPath) return;
        var im = new Image();
        im.className = 'logo';
        im.onload = function () { if (fallback.parentNode === holder) holder.replaceChild(im, fallback); };
        var p = info.iconPath;
        im.src = /^(file|https?|data):/.test(p) ? p : 'file://' + p;
      }, function () {});
    } catch (e) {}
  }

  function addCard() {
    var c = cardEl({ name: 'Ajustes', icon: 'gear', hue: 250 }, 'settings');
    c.className += ' add';
    return c;
  }

  function render() {
    var t0 = $('track0'), t1 = $('track1');
    t0.innerHTML = ''; t1.innerHTML = '';
    rows = [[], []];
    state.inputs.forEach(function (it) {
      if (it.hidden) return;
      var e = cardEl(it, 'input'); t0.appendChild(e);
      rows[0].push({ el: e, item: it, kind: 'input' });
    });
    state.apps.forEach(function (it) {
      if (it.hidden) return;
      var e = cardEl(it, 'app'); t1.appendChild(e);
      rows[1].push({ el: e, item: it, kind: 'app' });
    });
    var g = addCard(); t1.appendChild(g);
    rows[1].push({ el: g, kind: 'settings' });
    if (!rows[0].length) { rows[0].push({ el: null }); }
    if (focus.row > 1) focus.row = 1;
    if (focus.col >= rows[focus.row].length) focus.col = rows[focus.row].length - 1;
    if (focus.col < 0) focus.col = 0;
    paintFocus();
  }

  var CARD_W = 270, GAP = 28, AVAIL = 1760;
  function paintFocus() {
    rows.forEach(function (r, ri) {
      r.forEach(function (c, ci) {
        if (c.el) c.el.classList.toggle('focus', ri === focus.row && ci === focus.col);
      });
      var tr = $('track' + ri);
      var n = r.length, total = n * CARD_W + (n - 1) * GAP, x;
      if (total <= AVAIL) {
        x = (1760 - total) / 2;                        // centre short rows
      } else {
        var idx = ri === focus.row ? focus.col : 0;
        var fit = Math.floor((AVAIL + GAP) / (CARD_W + GAP));
        x = -Math.max(0, idx - (fit - 1)) * (CARD_W + GAP);
      }
      tr.style.transform = 'translateX(' + x + 'px)';
    });
  }

  function move(dx, dy) {
    var r = focus.row, c = focus.col;
    if (dy) {
      r = Math.max(0, Math.min(1, r + dy));
      if (!rows[r].length || (rows[r].length === 1 && !rows[r][0].el)) r = focus.row;
      c = Math.min(c, rows[r].length - 1);
    }
    if (dx) c = Math.max(0, Math.min(rows[r].length - 1, c + dx));
    focus.row = r; focus.col = c;
    paintFocus();
  }

  /* ---------- actions ---------- */
  function launchApp(item) {
    if (!hasTizen) { toast('(vista previa) abriria ' + item.name); return; }
    try {
      tizen.application.launch(item.appId, function () {}, function (e) {
        toast('No se pudo abrir ' + item.name + ' (' + (e && e.name ? e.name : 'error') + ')');
      });
    } catch (e) { toast('No se pudo abrir ' + item.name); }
  }

  function switchInput(item) {
    if (!hasTizen) { toast('(vista previa) cambiaria a HDMI ' + item.port); return; }
    // Samsung does not expose HDMI switching to regular web apps; try the known routes, then fall back.
    try {
      if (tizen.tvwindow && tizen.tvwindow.setSource) {
        tizen.tvwindow.setSource({ type: 'HDMI', number: item.port }, function () {}, function () {
          toast('Usa el boton SOURCE para cambiar a HDMI ' + item.port);
        });
        return;
      }
    } catch (e) {}
    toast('Este TV no deja cambiar HDMI desde apps. Usa SOURCE');
  }

  function activate() {
    var c = rows[focus.row][focus.col];
    if (!c || !c.el) return;
    if (c.kind === 'settings') return openSettings();
    if (c.kind === 'input') return switchInput(c.item);
    return launchApp(c.item);
  }

  /* ---------- generic menu ---------- */
  var menu = { open: false, entries: [], sel: 0, onBack: null };

  function showMenu(title, entries, onBack, keepSel) {
    menu.open = true; menu.entries = entries; menu.onBack = onBack || closeMenu;
    if (!keepSel) menu.sel = 0;
    menu.sel = Math.min(menu.sel, entries.length - 1);
    $('menutitle').textContent = title;
    $('menu').classList.remove('hidden');
    paintMenu();
  }
  function paintMenu() {
    var ul = $('menulist'); ul.innerHTML = '';
    var start = Math.max(0, Math.min(menu.sel - 3, menu.entries.length - 7));
    for (var i = start; i < Math.min(menu.entries.length, start + 7); i++) {
      var e = menu.entries[i];
      var li = el('li', i === menu.sel ? 'sel' : '');
      li.textContent = e.label;
      if (e.value != null) { var v = el('span', 'val'); v.textContent = e.value; li.appendChild(v); }
      ul.appendChild(li);
    }
  }
  function closeMenu() { menu.open = false; $('menu').classList.add('hidden'); render(); }

  var promptCb = null;
  function ask(title, value, cb) {
    $('prompttitle').textContent = title;
    var inp = $('promptinput'); inp.value = value || '';
    $('prompt').classList.remove('hidden');
    promptCb = cb;
    setTimeout(function () { inp.focus(); }, 50);
  }
  function endPrompt(ok) {
    var inp = $('promptinput');
    $('prompt').classList.add('hidden'); inp.blur();
    var cb = promptCb; promptCb = null;
    if (ok && cb) cb(inp.value);
    if (menu.open) paintMenu();
  }

  /* ---------- settings screens ---------- */
  function openSettings() {
    showMenu('AJUSTES', [
      { label: 'Entradas HDMI', action: function () { editList('inputs'); } },
      { label: 'Apps', action: function () { editList('apps'); } },
      { label: 'Clima: ciudad', value: state.city.name, action: editCity },
      { label: 'Restaurar valores', action: confirmReset },
      { label: 'Volver', action: closeMenu }
    ], closeMenu);
  }

  function editCity() {
    ask('Nombre de la ciudad', state.city.name, function (n) {
      state.city.name = n || state.city.name;
      ask('Latitud (ej -31.4135)', String(state.city.lat), function (la) {
        ask('Longitud (ej -64.181)', String(state.city.lon), function (lo) {
          var a = parseFloat(la), b = parseFloat(lo);
          if (!isNaN(a) && !isNaN(b)) { state.city.lat = a; state.city.lon = b; }
          save(); loadWeather(); openSettings();
        });
      });
    });
  }

  function confirmReset() {
    showMenu('Restaurar todo?', [
      { label: 'No, volver', action: openSettings },
      { label: 'Si, restaurar', action: function () { state = clone(DEFAULTS); save(); loadWeather(); openSettings(); } }
    ], openSettings);
  }

  function editList(key) {
    var list = state[key];
    var entries = list.map(function (it, i) {
      return {
        label: it.name, value: it.hidden ? 'oculto' : '',
        action: function () { editItem(key, i); }
      };
    });
    if (key === 'apps') {
      entries.push({ label: '+ Agregar de apps instaladas', action: function () { pickInstalled(); } });
      entries.push({ label: '+ Agregar con ID manual', action: function () { addManual(); } });
    } else {
      entries.push({ label: '+ Agregar entrada', action: function () { addInput(); } });
    }
    entries.push({ label: 'Volver', action: openSettings });
    showMenu(key === 'inputs' ? 'ENTRADAS HDMI' : 'APPS', entries, openSettings, true);
  }

  function editItem(key, i) {
    var list = state[key], it = list[i];
    function refresh() { save(); editItem(key, i); }
    var entries = [
      { label: 'Renombrar', value: it.name, action: function () { ask('Nombre', it.name, function (v) { if (v) it.name = v; refresh(); }); } }
    ];
    if (key === 'inputs') {
      entries.push({ label: 'Texto chico', value: it.sub || '', action: function () { ask('Texto chico', it.sub || '', function (v) { it.sub = v; refresh(); }); } });
    } else {
      entries.push({ label: 'ID de la app', value: it.appId, action: function () { ask('ID de la app', it.appId, function (v) { if (v) it.appId = v; refresh(); }); } });
    }
    entries.push(
      { label: 'Color', value: 'hue ' + it.hue, action: function () { it.hue = HUES[(HUES.indexOf(it.hue) + 1) % HUES.length]; refresh(); } },
      { label: 'Icono', value: it.icon, action: function () { it.icon = ICONS[(ICONS.indexOf(it.icon) + 1) % ICONS.length]; refresh(); } },
      { label: it.hidden ? 'Mostrar' : 'Ocultar', action: function () { it.hidden = !it.hidden; refresh(); } },
      { label: 'Mover antes', action: function () { if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); save(); editItem(key, i - 1); } } },
      { label: 'Mover despues', action: function () { if (i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); save(); editItem(key, i + 1); } } },
      { label: 'Eliminar', action: function () { list.splice(i, 1); save(); editList(key); } },
      { label: 'Volver', action: function () { editList(key); } }
    );
    showMenu(it.name, entries, function () { editList(key); }, true);
  }

  function uid() { return 'x' + Date.now().toString(36); }

  function addInput() {
    var n = state.inputs.length + 1;
    ask('Nombre de la entrada', 'HDMI ' + n, function (name) {
      ask('Numero de puerto HDMI', String(n), function (p) {
        state.inputs.push({ id: uid(), name: name || ('HDMI ' + n), sub: 'Entrada', hue: HUES[n % HUES.length], icon: 'hdmi', port: parseInt(p, 10) || n, hidden: false });
        save(); editList('inputs');
      });
    });
  }

  function addManual() {
    ask('Nombre de la app', '', function (name) {
      if (!name) return editList('apps');
      ask('ID de la app (ej 3201907018807)', '', function (id) {
        if (id) {
          state.apps.push({ id: uid(), name: name, appId: id, hue: HUES[state.apps.length % HUES.length], icon: 'grid', hidden: false });
          save();
        }
        editList('apps');
      });
    });
  }

  function pickInstalled() {
    if (!hasTizen || !tizen.application || !tizen.application.getAppsInfo) {
      toast('La lista de apps solo funciona dentro del TV');
      return;
    }
    tizen.application.getAppsInfo(function (infos) {
      var have = {};
      state.apps.forEach(function (a) { have[a.appId] = true; });
      var entries = infos.filter(function (a) { return !have[a.id] && a.name; }).map(function (a) {
        return {
          label: a.name,
          action: function () {
            state.apps.push({ id: uid(), name: a.name, appId: a.id, hue: HUES[state.apps.length % HUES.length], icon: 'grid', hidden: false });
            save(); editList('apps');
          }
        };
      });
      entries.sort(function (a, b) { return a.label < b.label ? -1 : 1; });
      entries.push({ label: 'Volver', action: function () { editList('apps'); } });
      showMenu('APPS INSTALADAS', entries, function () { editList('apps'); });
    }, function () { toast('No se pudo leer la lista de apps'); });
  }

  /* ---------- keys ---------- */
  var K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BKSP: 8 };

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (!$('prompt').classList.contains('hidden')) {
      if (k === K.ENTER && document.activeElement === $('promptinput') && !e.__ime) {
        // first OK opens TV keyboard (native); Done/Enter from keyboard lands here too
        if (promptReady) { e.preventDefault(); endPrompt(true); promptReady = false; }
        else promptReady = true;
      } else if (k === K.BACK || k === K.ESC) { e.preventDefault(); endPrompt(false); promptReady = false; }
      return;
    }
    if (menu.open) {
      if (k === K.UP) { menu.sel = (menu.sel + menu.entries.length - 1) % menu.entries.length; paintMenu(); e.preventDefault(); }
      else if (k === K.DOWN) { menu.sel = (menu.sel + 1) % menu.entries.length; paintMenu(); e.preventDefault(); }
      else if (k === K.ENTER) { e.preventDefault(); var en = menu.entries[menu.sel]; if (en && en.action) en.action(); }
      else if (k === K.BACK || k === K.ESC) { e.preventDefault(); menu.onBack(); }
      return;
    }
    if (k === K.LEFT) { move(-1, 0); e.preventDefault(); }
    else if (k === K.RIGHT) { move(1, 0); e.preventDefault(); }
    else if (k === K.UP) { move(0, -1); e.preventDefault(); }
    else if (k === K.DOWN) { move(0, 1); e.preventDefault(); }
    else if (k === K.ENTER) { e.preventDefault(); activate(); }
  });
  var promptReady = false;
  $('promptinput').addEventListener('focus', function () { promptReady = false; });

  /* ---------- Zelda dressing: triforce, hearts, dungeon bricks ---------- */
  function decorate() {
    drawSprite($('logo'), SPRITES.triforce, 0, TRI_PAL);
    var h = $('hearts');
    for (var i = 0; i < 3; i++) {
      var cv = el('canvas'); cv.width = 9; cv.height = 8;
      drawSprite(cv, SPRITES.heart, 0, HEART_PAL);
      h.appendChild(cv);
    }
    var hc = el('canvas');
    drawSprite(hc, SPRITES.heart, 0, HEART_PAL);
    var up = el('canvas'); up.width = 18; up.height = 16;
    var uctx = up.getContext('2d'); uctx.imageSmoothingEnabled = false;
    uctx.drawImage(hc, 0, 0, 18, 16);
    var root = document.documentElement.style;
    root.setProperty('--heart', 'url(' + up.toDataURL() + ')');
    // faint brick tile, 24x24 art drawn at 4x
    var b = el('canvas'); b.width = 24; b.height = 24;
    var x = b.getContext('2d');
    x.fillStyle = '#0a0a12'; x.fillRect(0, 0, 24, 24);
    x.fillStyle = '#10101c';
    x.fillRect(0, 0, 24, 1); x.fillRect(0, 12, 24, 1);
    x.fillRect(0, 0, 1, 12); x.fillRect(12, 12, 1, 12);
    root.setProperty('--brick', 'url(' + b.toDataURL() + ')');
  }

  /* ---------- boot ---------- */
  decorate();
  fit(); setTimeout(fit, 300); window.addEventListener('load', fit);
  tick(); setInterval(tick, 1000);
  loadWeather(); setInterval(loadWeather, 15 * 60 * 1000);
  render();
})();
