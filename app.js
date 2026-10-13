/* UI for the DTHub shuttle planner. Data: data.js. Logic: schedule.js. */
(function () {
  'use strict';

  var D = window.SHUTTLE_DATA;
  var S = window.Schedule;
  var STORE = 'dthubShuttle.v1';
  var HOME = D.home;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    from: $('from'), to: $('to'), swap: $('swap'), taxi: $('taxi'),
    nowBtn: $('nowBtn'), laterBtn: $('laterBtn'), whenInputs: $('whenInputs'),
    date: $('date'), time: $('time'), clock: $('clock'), daychip: $('daychip'),
    hero: $('hero'), dests: $('dests'), destsTitle: $('destsTitle'),
    board: $('board'), listTitle: $('listTitle'), earlier: $('earlier'),
    stopInfo: $('stopInfo'), holUntil: $('holUntil')
  };

  var state = { from: HOME, to: '', taxi: false, live: true, date: '', time: '', showEarlier: false };

  // ---------- persistence ----------
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || '{}');
      if (s.from && D.stops[s.from]) state.from = s.from;
      if (typeof s.to === 'string') state.to = s.to;
      if (typeof s.taxi === 'boolean') state.taxi = s.taxi;
    } catch (e) { /* storage unavailable */ }
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('from') && D.stops[q.get('from')]) state.from = q.get('from');
      if (q.has('to')) state.to = D.stops[q.get('to')] ? q.get('to') : '';
      if (q.get('taxi') === '1') state.taxi = true;
    } catch (e) { /* no query support */ }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ from: state.from, to: state.to, taxi: state.taxi })); } catch (e) { }
  }

  // ---------- formatting ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function stopName(id) { return D.stops[id].name; }
  function prettyDate(iso) {
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
    });
  }
  function dayWord(offset, iso) {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    return prettyDate(iso);
  }
  function dayTypeLabel(iso) {
    if (D.holidays[iso]) return 'Public holiday · no service';
    return S.DAY_LABEL[S.dayType(iso, D)] + ' timetable';
  }
  function relText(dep, nowMin) {
    if (dep.offset > 0) return dayWord(dep.offset, dep.date);
    var diff = dep.min - nowMin;
    if (diff <= 0) return 'Leaving now';
    if (diff < 60) return 'in ' + diff + ' min';
    var h = Math.floor(diff / 60), m = diff % 60;
    return 'in ' + h + 'h' + (m ? ' ' + m + 'm' : '');
  }
  function destSummary(dep) {
    if (state.to) return stopName(state.to);
    return dep.dests.map(function (x) { return D.stops[x.stop].short; }).join(' · ');
  }

  // ---------- reference time ----------
  function ref() {
    if (state.live) {
      var n = S.hkNow();
      return { date: n.date, min: n.minutes, live: true };
    }
    var t = state.time || '00:00';
    return { date: state.date, min: S.toMin(t), live: false };
  }

  // ---------- pickers ----------
  function fillFrom() {
    var opts = S.boardingStops(D, { taxi: true });
    if (opts.indexOf(state.from) < 0) state.from = HOME;
    el.from.innerHTML = opts.map(function (id) {
      var s = D.stops[id];
      return '<option value="' + id + '"' + (id === state.from ? ' selected' : '') + '>' +
        esc(s.name) + '</option>';
    }).join('');
  }
  function fillTo() {
    var opts = S.reachable(D, state.from, { taxi: true });
    if (state.to && opts.indexOf(state.to) < 0) state.to = '';
    el.to.innerHTML = '<option value="">Any destination</option>' + opts.map(function (id) {
      var s = D.stops[id];
      return '<option value="' + id + '"' + (id === state.to ? ' selected' : '') + '>' +
        esc(s.name) + '</option>';
    }).join('');
  }

  // ---------- render ----------
  function renderClock(r) {
    var n = S.hkNow();
    el.clock.textContent = S.fmtMin(n.minutes);
    el.clock.title = 'Hong Kong time';
    var iso = r.date;
    el.daychip.textContent = (r.live ? '' : 'Planning · ') + prettyDate(iso) + ' · ' +
      (D.holidays[iso] ? 'Public holiday' : S.DAY_LABEL[S.dayType(iso, D)]);
    el.daychip.classList.toggle('ph', !!D.holidays[iso]);
    el.daychip.title = D.holidays[iso] ? D.holidays[iso] + ' (no service)' : '';
  }

  function hiddenTaxiCount(r) {
    if (state.taxi) return 0;
    var withTaxi = S.plan(D, state.from, state.to, r.date, r.min, { taxi: true });
    var without = S.plan(D, state.from, state.to, r.date, r.min, { taxi: false });
    return withTaxi.upcoming.length - without.upcoming.length;
  }

  function renderHero(p, r) {
    var dep = p.next;
    var hidden = hiddenTaxiCount(r);
    var taxiHint = hidden > 0
      ? '<p class="note taxi">' + hidden + ' booked-taxi slot' + (hidden > 1 ? 's' : '') +
        ' later today ' + (hidden > 1 ? 'are' : 'is') + ' hidden. Turn on <strong>Include booked taxis</strong> to see ' +
        (hidden > 1 ? 'them' : 'it') + '.</p>'
      : '';

    if (!dep) {
      el.hero.innerHTML = '<div class="empty"><strong>No departures in the next week</strong>' +
        'Nothing in the timetable runs from ' + esc(stopName(state.from)) +
        (state.to ? ' to ' + esc(stopName(state.to)) : '') + '.</div>' + taxiHint;
      return;
    }

    var trip = dep.trip;
    var bi = 0;
    trip.stops.forEach(function (s, i) { if (s[0] === state.from && s[1] === dep.time) bi = i; });
    var passedTarget = false;
    var chain = trip.stops.slice(bi).map(function (s, k) {
      var cls = '';
      if (k > 0 && state.to) {
        if (passedTarget) cls = 'dim';
        if (s[0] === state.to) { cls = 'target'; passedTarget = true; }
      }
      var flag = s[2] === 'on' ? ' <span class="t">pick-up</span>' : '';
      return '<li class="' + cls + '">' + esc(D.stops[s[0]].short) +
        (s[1] ? ' <span class="t">' + s[1] + '</span>' : '') + flag + '</li>';
    }).join('');

    var diff = dep.offset === 0 ? dep.min - r.min : 9999;
    var isTaxi = trip.mode === 'taxi';
    var band = dep.offset === 0
      ? (r.live ? 'Next departure' : 'First departure after ' + S.fmtMin(r.min))
      : 'Next departure';
    var dayBit = dayWord(dep.offset, dep.date) + (dep.offset > 0 ? ' · ' + dayTypeLabel(dep.date) : '');

    el.hero.innerHTML =
      '<div class="hero-band"><span class="label">' + esc(band) + '</span>' +
      '<span class="when-day">' + esc(dep.offset === 0 ? prettyDate(dep.date) : dayBit) + '</span></div>' +
      '<div class="hero-body">' +
        '<div class="hero-row">' +
          '<div class="big-time">' + dep.time + '</div>' +
          '<div class="count' + (diff <= 10 ? ' soon' : '') + '">' + esc(relText(dep, r.min)) + '</div>' +
        '</div>' +
        '<ul class="chain">' + chain + '</ul>' +
        '<div class="meta">' +
          '<span class="pill' + (isTaxi ? ' taxi' : '') + '">' + (isTaxi ? 'Booked taxi' : 'Shuttle bus') + '</span>' +
          '<span class="pill ghost">' + esc(D.lines[trip.line].name) + '</span>' +
          (dep.arrive ? '<span class="pill ghost">Arrives ' + dep.arrive + '</span>' : '') +
        '</div>' +
        '<p class="where">Board at <strong>' + esc(stopName(state.from)) + '</strong>: ' + esc(D.stops[state.from].where) + '</p>' +
        (trip.note ? '<p class="note' + (isTaxi ? ' taxi' : '') + '">' + esc(trip.note) + '</p>' : '') +
        taxiHint +
      '</div>';
  }

  function renderDests(r) {
    var list = S.nextByDestination(D, state.from, r.date, r.min, { taxi: state.taxi });
    el.destsTitle.textContent = 'Next from ' + D.stops[state.from].short + ' to each stop';
    el.dests.innerHTML = list.map(function (x) {
      var s = D.stops[x.dest];
      var n = x.next;
      var when = n ? n.time : '—';
      var rel = n ? relText(n, r.min) : 'No service this week';
      var taxi = n && n.trip.mode === 'taxi';
      return '<button type="button" class="dest' + (taxi ? ' taxi-only' : '') + '" data-dest="' + x.dest +
        '" aria-pressed="' + (state.to === x.dest) + '">' +
        '<span class="name">' + esc(s.short) + '</span>' +
        '<span class="zh2" lang="zh-HK">' + esc(s.zh) + '</span>' +
        '<span class="dt">' + when + '</span>' +
        '<span class="rel' + (n && n.offset === 0 ? ' today' : '') + '">' + esc(rel) + (taxi ? ' · taxi' : '') + '</span>' +
        '</button>';
    }).join('');
  }

  function row(dep, r, isNext) {
    var t = dep.trip;
    var cls = [];
    if (dep.past) cls.push('past');
    if (isNext) cls.push('is-next');
    if (t.mode === 'taxi') cls.push('taxi');
    var sub = D.lines[t.line].name;
    if (t.mode === 'taxi') sub += ' · book 30 min ahead';
    if (dep.arrive) sub += ' · arrives ' + dep.arrive;
    return '<li class="' + cls.join(' ') + '">' +
      '<span class="bt">' + dep.time + '</span>' +
      '<span class="bd">' + esc(destSummary(dep)) + '<small>' + esc(sub) + '</small></span>' +
      '<span class="br">' + (dep.past ? 'Gone' : esc(relText(dep, r.min))) + '</span></li>';
  }

  function renderBoard(p, r) {
    var title = 'From ' + D.stops[state.from].short + (state.to ? ' to ' + D.stops[state.to].short : '');
    var dayLbl = r.live ? 'Today' : prettyDate(r.date);
    el.listTitle.textContent = title + ' · ' + dayLbl;

    var past = p.today.filter(function (d) { return d.past; });
    el.earlier.hidden = past.length === 0;
    el.earlier.textContent = state.showEarlier ? 'Hide earlier' : 'Show earlier (' + past.length + ')';

    var html = '';
    var shown = state.showEarlier ? p.today : p.upcoming;
    var nextMarked = false;
    shown.forEach(function (d) {
      var isNext = !d.past && !nextMarked;
      if (isNext) nextMarked = true;
      html += row(d, r, isNext);
    });
    if (!p.upcoming.length) {
      html += '<li class="day-sep">' + (p.today.length ? 'No more departures ' + (r.live ? 'today' : 'this day') : 'No service ' + (r.live ? 'today' : 'this day')) + '</li>';
      if (p.nextDay) {
        html += '<li class="day-sep">' + esc(dayWord(p.nextDay.list[0].offset, p.nextDay.date) + ' · ' + dayTypeLabel(p.nextDay.date)) + '</li>';
        p.nextDay.list.forEach(function (d, i) { html += row(d, r, i === 0); });
      }
    }
    el.board.innerHTML = html;
  }

  function renderStopInfo() {
    el.stopInfo.innerHTML = D.stopOrder.map(function (id) {
      var s = D.stops[id];
      return '<div><dt>' + esc(s.name) + '<span lang="zh-HK">' + esc(s.zh) + '</span></dt><dd>' + esc(s.where) + '</dd></div>';
    }).join('');
    el.holUntil.textContent = prettyDate(D.holidaysUntil).replace(/^\w+,?\s*/, '') + ' ' + D.holidaysUntil.slice(0, 4);
  }

  function render() {
    var r = ref();
    if (!r.date) return;
    el.swap.disabled = state.from === HOME && !state.to;
    var p = S.plan(D, state.from, state.to, r.date, r.min, { taxi: state.taxi });
    renderClock(r);
    renderHero(p, r);
    renderDests(r);
    renderBoard(p, r);
  }

  // ---------- events ----------
  function setLive(live) {
    state.live = live;
    el.nowBtn.setAttribute('aria-pressed', String(live));
    el.laterBtn.setAttribute('aria-pressed', String(!live));
    el.whenInputs.hidden = live;
    if (!live) {
      var n = S.hkNow();
      if (!state.date) state.date = n.date;
      if (!state.time) state.time = S.fmtMin(n.minutes);
      el.date.value = state.date;
      el.time.value = state.time;
    }
    render();
  }

  el.from.addEventListener('change', function () {
    state.from = el.from.value; fillTo(); save(); render();
  });
  el.to.addEventListener('change', function () { state.to = el.to.value; save(); render(); });
  el.swap.addEventListener('click', function () {
    var a = state.from;
    if (!state.to) {
      // "From X to anywhere" swaps to "home stop to X".
      if (a === HOME) return;
      state.to = a; state.from = HOME;
      fillFrom(); fillTo(); save(); render();
      return;
    }
    state.from = state.to; state.to = a;
    if (S.boardingStops(D, { taxi: true }).indexOf(state.from) < 0) { state.from = a; state.to = ''; }
    fillFrom(); fillTo(); save(); render();
  });
  if (el.taxi) el.taxi.addEventListener('change', function () { state.taxi = el.taxi.checked; save(); render(); });
  el.nowBtn.addEventListener('click', function () { setLive(true); });
  el.laterBtn.addEventListener('click', function () { setLive(false); });
  el.date.addEventListener('change', function () { if (el.date.value) { state.date = el.date.value; render(); } });
  el.time.addEventListener('change', function () { if (el.time.value) { state.time = el.time.value; render(); } });
  el.earlier.addEventListener('click', function () { state.showEarlier = !state.showEarlier; render(); });
  el.dests.addEventListener('click', function (e) {
    var b = e.target.closest('.dest');
    if (!b) return;
    var d = b.getAttribute('data-dest');
    state.to = state.to === d ? '' : d;
    fillTo(); save(); render();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  setInterval(function () { if (state.live) render(); else renderClock(ref()); }, 15000);

  // ---------- boot ----------
  load();
  if (el.taxi) el.taxi.checked = state.taxi;
  fillFrom();
  fillTo();
  renderStopInfo();
  setLive(true);
})();
