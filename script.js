// 수업 시간표(구글 시트) + 3단계 예약 안내. 의존성 없는 순수 JavaScript.
(function () {
  // ── 수업 시간표: 구글 시트 "수업일정" 탭 ─────────────
  // 시트를 웹에 게시(파일 → 공유 → 웹에 게시 → 수업일정 · CSV)한 주소를 넣는다.
  // 비어 있거나 못 읽으면 assets/data/schedule-fallback.js 데이터를 쓴다.
  var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSwCMATBARdnl8LRth74qt85AwzxrDImwlK9-njSuQk7za9piiVH188-rLOra_eFzlIEHUf8vkebGaq/pub?gid=1871967222&single=true&output=csv';
  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  var SLOTS = [
    { id: 'am', name: '출근 전', sub: '06:30 · 07:30' },
    { id: 'noon', name: '점심', sub: '12:00' },
    { id: 'pm', name: '퇴근 후', sub: '17:30 · 18:30 · 19:30' },
    { id: 'sat', name: '토요일', sub: '11:00' }
  ];
  var EXP = [{ id: 'yes', name: '네, 해 봤어요' }, { id: 'no', name: '처음이에요' }];
  var PAIN = [{ id: 'no', name: '없어요' }, { id: 'yes', name: '있어요' }];

  var ON = { border: '#E71873', bg: 'rgba(231,24,115,0.12)' };
  var OFF = { border: '#5E5452', bg: 'transparent' };
  var state = { week: null, day: null, slot: null, exp: null, pain: null };
  var schedule = [];

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute('style', style);
    if (text != null) n.textContent = text;
    return n;
  }
  function paint(btn, on) {
    var c = on ? ON : OFF;
    btn.style.borderColor = c.border; btn.style.background = c.bg;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ── 수업 시간표 ───────────────────────────────────────
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function fromSheet(text) {
    var rows = parseCSV(text), head = rows.shift() || [];
    function col(name) { return head.map(function (h) { return h.trim(); }).indexOf(name); }
    var c = { date: col('날짜'), start: col('시작'), end: col('종료'), theme: col('테마'), name: col('수업명'), desc: col('수업 설명(자동)'), teacher: col('강사') };
    return rows.map(function (r) {
      function v(k) { return c[k] < 0 ? '' : (r[c[k]] || '').trim(); }
      return { date: v('date'), start: v('start'), end: v('end'), theme: v('theme'), name: v('name'), desc: v('desc'), teacher: v('teacher') };
    }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.start && x.name; });
  }
  function toDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function key(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function monday(d) { var m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return m; }
  function md(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }

  function weeks() {
    var thisMon = key(monday(new Date())), seen = {};
    schedule.forEach(function (x) { seen[key(monday(toDate(x.date)))] = true; });
    var all = Object.keys(seen).sort(), upcoming = all.filter(function (w) { return w >= thisMon; });
    return upcoming.length ? upcoming : all.slice(-1);
  }
  function renderSchedule() {
    var wbox = document.getElementById('sched-weeks'), dbox = document.getElementById('sched-days'),
        list = document.getElementById('sched-list'), empty = document.getElementById('sched-empty');
    var ws = weeks();
    empty.hidden = ws.length > 0; list.hidden = dbox.hidden = !ws.length;
    if (!ws.length) { wbox.textContent = ''; return; }
    if (ws.indexOf(state.week) < 0) { state.week = ws[0]; state.day = null; }
    var thisMon = key(monday(new Date()));
    wbox.textContent = '';
    ws.forEach(function (w) {
      var m = toDate(w), sat = new Date(m); sat.setDate(m.getDate() + 5);
      var label = (w === thisMon ? '이번 주' : '') + (w === thisMon ? ' · ' : '') + md(m) + ' ~ ' + md(sat);
      var b = el('button', 'min-height:44px;padding:0 18px;border-radius:999px;font-family:inherit;font-size:14px;cursor:pointer;border:1px solid;color:#FFFFFF', label);
      b.type = 'button'; paint(b, w === state.week);
      b.addEventListener('click', function () { state.week = w; state.day = null; renderSchedule(); });
      wbox.appendChild(b);
    });
    var mon = toDate(state.week), days = [];
    for (var i = 0; i < 6; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); days.push(key(d)); }
    var byDay = {};
    schedule.forEach(function (x) { if (days.indexOf(x.date) >= 0) (byDay[x.date] = byDay[x.date] || []).push(x); });
    if (!state.day || !byDay[state.day]) {
      var today = key(new Date());
      state.day = byDay[today] ? today : days.filter(function (k) { return byDay[k]; })[0];
    }
    dbox.textContent = '';
    days.forEach(function (k) {
      var d = toDate(k), has = !!byDay[k];
      var b = el('button', 'min-height:56px;min-width:64px;padding:6px 14px;border-radius:12px;font-family:inherit;cursor:pointer;border:1px solid;color:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px' + (has ? '' : ';opacity:.4;cursor:default'));
      b.type = 'button'; b.disabled = !has;
      b.appendChild(el('span', 'font-size:15px;font-weight:500', WEEKDAYS[d.getDay()]));
      b.appendChild(el('span', "font-family:'Jost',sans-serif;font-size:12px;color:#A39895", md(d)));
      paint(b, k === state.day);
      b.addEventListener('click', function () { state.day = k; renderSchedule(); });
      dbox.appendChild(b);
    });
    list.textContent = '';
    (byDay[state.day] || []).slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (x) {
      var item = el('details', 'border-top:1px solid #3D3334');
      var sum = el('summary', 'list-style:none;cursor:pointer;min-height:64px;padding:16px 4px;display:grid;grid-template-columns:96px 1fr auto;gap:8px 16px;align-items:center');
      sum.appendChild(el('span', "font-family:'Jost',sans-serif;font-size:17px;font-weight:500", x.start + (x.end ? '–' + x.end : '')));
      var title = el('span', 'display:flex;flex-direction:column;gap:2px');
      var blaz = /^BLAZ\s*-\s*/i.test(x.name), nm = x.name.replace(/^BLAZ\s*-\s*/i, '');
      var line = el('span', 'font-size:16px;font-weight:500', nm);
      if (blaz) line.appendChild(el('span', "margin-left:8px;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:0.14em;color:#ED4C92;vertical-align:2px", 'BLAZ'));
      title.appendChild(line);
      title.appendChild(el('span', "font-family:'Jost',sans-serif;font-size:12px;letter-spacing:0.12em;color:#A39895", x.theme + (x.teacher ? ' · ' + x.teacher : '')));
      sum.appendChild(title);
      var more = el('span', 'font-size:13px;color:#A39895', x.desc ? '설명 +' : ''); more.className = 'sched-more';
      sum.appendChild(more);
      item.appendChild(sum);
      if (x.desc) item.appendChild(el('p', 'margin:0 0 20px;padding:0 4px;max-width:760px;font-size:14px;line-height:1.8;color:#C9C1BE;white-space:pre-line', x.desc));
      list.appendChild(item);
    });
  }
  function loadSchedule() {
    schedule = (window.SCHEDULE_FALLBACK || []).slice();
    renderSchedule();
    if (!SHEET_CSV_URL || !window.fetch) return;
    fetch(SHEET_CSV_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { var rows = fromSheet(t); if (rows.length) { schedule = rows; renderSchedule(); } })
      .catch(function () { /* 예비 데이터 유지 */ });
  }

  // ── 3단계 예약 안내 ───────────────────────────────────
  function renderOptions(boxId, items, key, withSub) {
    var box = document.getElementById(boxId); box.textContent = '';
    items.forEach(function (it) {
      var b = el('button', 'min-height:52px;padding:0 18px;border-radius:12px;font-family:inherit;font-size:15px;cursor:pointer;text-align:left;border:1px solid;color:#FFFFFF;' +
        (withSub ? 'display:flex;justify-content:space-between;align-items:center;gap:12px' : ''));
      b.type = 'button';
      if (withSub) {
        b.appendChild(el('span', 'font-weight:500', it.name));
        b.appendChild(el('span', 'font-size:13px;color:#C9C1BE', it.sub));
      } else { b.textContent = it.name; }
      paint(b, state[key] === it.id);
      b.addEventListener('click', function () { state[key] = it.id; renderBooking(); });
      box.appendChild(b);
    });
  }
  function renderBooking() {
    renderOptions('opt-slot', SLOTS, 'slot', true);
    renderOptions('opt-exp', EXP, 'exp', false);
    renderOptions('opt-pain', PAIN, 'pain', false);
    var done = [state.slot, state.exp, state.pain].filter(Boolean).length;
    var ready = done === 3;
    var direct = ready && state.exp === 'yes' && state.pain === 'no';
    document.getElementById('progress-text').textContent = '선택 완료 ' + done + ' / 3';
    document.getElementById('result-pending').hidden = ready;
    document.getElementById('result-direct').hidden = !direct;
    document.getElementById('result-consult').hidden = !(ready && !direct);
    var s = SLOTS.filter(function (x) { return x.id === state.slot; })[0];
    Array.prototype.forEach.call(document.querySelectorAll('.slot-text'), function (n) { n.textContent = s ? s.name : ''; });
  }

  // ── 영상: 소리 없이 자동 재생, 누르면 소리 켜기 ────────
  Array.prototype.forEach.call(document.querySelectorAll('.zone-video'), function (box) {
    var v = box.querySelector('video'), btn = box.querySelector('.sound-toggle');
    function toggle() {
      v.muted = !v.muted;
      if (!v.muted) v.play();
      btn.textContent = v.muted ? 'SOUND OFF' : 'SOUND ON';
      btn.setAttribute('aria-pressed', String(!v.muted));
    }
    btn.addEventListener('click', toggle);
    v.addEventListener('click', toggle);
  });

  loadSchedule();
  renderBooking();
})();
