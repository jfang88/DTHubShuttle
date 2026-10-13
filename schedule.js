/*
 * Pure timetable logic (no DOM). Works in the browser (window.Schedule)
 * and in Node (require('./schedule.js')) for tests.
 */
(function (root) {
  'use strict';

  var TZ = 'Asia/Hong_Kong';
  var DAY_LABEL = { wd: 'Weekday', sat: 'Saturday', sun: 'Sunday & public holiday' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toMin(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function fmtMin(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

  // Current wall-clock time in Hong Kong, whatever the device time zone.
  function hkNow(d) {
    d = d || new Date();
    var parts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
    return {
      date: parts.year + '-' + parts.month + '-' + parts.day,
      minutes: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10),
      seconds: parseInt(parts.second, 10)
    };
  }

  function parseDate(s) {
    var p = s.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }

  function addDays(s, n) {
    var d = parseDate(s);
    d.setUTCDate(d.getUTCDate() + n);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function weekday(s) { return parseDate(s).getUTCDay(); } // 0 = Sun

  function dayType(s, data) {
    if (data.holidays[s]) return 'sun';
    var w = weekday(s);
    if (w === 0) return 'sun';
    if (w === 6) return 'sat';
    return 'wd';
  }

  function canBoard(trip, i) {
    var s = trip.stops[i];
    return i < trip.stops.length - 1 && s[2] !== 'off' && s[1] != null;
  }

  function canAlight(trip, j) { return j > 0 && trip.stops[j][2] !== 'on'; }

  // All departures from `from` on a given day type, optionally filtered to reach `to`.
  function departures(data, from, dt, opts) {
    opts = opts || {};
    var out = [];
    data.trips.forEach(function (trip) {
      if (trip.days.indexOf(dt) < 0) return;
      if (trip.mode === 'taxi' && !opts.taxi) return;
      for (var i = 0; i < trip.stops.length; i++) {
        if (trip.stops[i][0] !== from || !canBoard(trip, i)) continue;
        var dests = [];
        for (var j = i + 1; j < trip.stops.length; j++) {
          if (canAlight(trip, j)) dests.push({ stop: trip.stops[j][0], time: trip.stops[j][1] });
        }
        var arrive = null;
        if (opts.to) {
          var hit = dests.filter(function (x) { return x.stop === opts.to; })[0];
          if (!hit) continue;
          arrive = hit.time;
        }
        out.push({
          trip: trip, time: trip.stops[i][1], min: toMin(trip.stops[i][1]),
          dests: dests, arrive: arrive
        });
      }
    });
    out.sort(function (a, b) {
      return a.min - b.min || (a.trip.mode === 'taxi') - (b.trip.mode === 'taxi');
    });
    return out;
  }

  // Every stop you can board at (for the "From" picker).
  function boardingStops(data, opts) {
    var seen = {};
    data.trips.forEach(function (t) {
      if (t.mode === 'taxi' && !(opts && opts.taxi)) return;
      t.stops.forEach(function (s, i) { if (canBoard(t, i)) seen[s[0]] = true; });
    });
    return data.stopOrder.filter(function (id) { return seen[id]; });
  }

  // Every stop reachable from `from` on any day.
  function reachable(data, from, opts) {
    var seen = {};
    ['wd', 'sat', 'sun'].forEach(function (dt) {
      departures(data, from, dt, opts).forEach(function (d) {
        d.dests.forEach(function (x) { seen[x.stop] = true; });
      });
    });
    return data.stopOrder.filter(function (id) { return seen[id] && id !== from; });
  }

  /*
   * Departures on `date` from `from` (to `to` if given), each flagged past/upcoming
   * relative to nowMin, plus the first upcoming departure within `horizon` days.
   */
  function plan(data, from, to, date, nowMin, opts, horizon) {
    opts = opts || {};
    horizon = horizon || 8;
    var q = { taxi: opts.taxi, to: to || null };
    var dt = dayType(date, data);
    var today = departures(data, from, dt, q).map(function (d) {
      d.past = d.min < nowMin;
      d.date = date;
      d.offset = 0;
      return d;
    });
    var next = null, nextDay = null;
    var up = today.filter(function (d) { return !d.past; });
    if (up.length) {
      next = up[0];
    } else {
      for (var k = 1; k <= horizon; k++) {
        var dd = addDays(date, k);
        var list = departures(data, from, dayType(dd, data), q);
        if (list.length) {
          list.forEach(function (d) { d.date = dd; d.offset = k; d.past = false; });
          next = list[0];
          nextDay = { date: dd, dayType: dayType(dd, data), list: list };
          break;
        }
      }
    }
    return { date: date, dayType: dt, today: today, upcoming: up, next: next, nextDay: nextDay };
  }

  // Next departure to each reachable destination from `from`.
  function nextByDestination(data, from, date, nowMin, opts) {
    return reachable(data, from, opts).map(function (dest) {
      var p = plan(data, from, dest, date, nowMin, opts);
      var everyday = {};
      ['wd', 'sat', 'sun'].forEach(function (dt) {
        everyday[dt] = departures(data, from, dt, { taxi: opts && opts.taxi, to: dest }).length > 0;
      });
      return { dest: dest, next: p.next, upcomingToday: p.upcoming.length, runs: everyday };
    });
  }

  var api = {
    TZ: TZ, DAY_LABEL: DAY_LABEL,
    toMin: toMin, fmtMin: fmtMin, hkNow: hkNow, addDays: addDays, weekday: weekday,
    dayType: dayType, departures: departures, boardingStops: boardingStops,
    reachable: reachable, plan: plan, nextByDestination: nextByDestination
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Schedule = api;
})(this);
