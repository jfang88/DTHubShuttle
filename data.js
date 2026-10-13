/*
 * Data Technology Hub (DTHub) / Advanced Manufacturing Centre employees' shuttle bus.
 * Source: DTH Facilities Management Office circular DTH/CIR/2024/01/044 (24 May 2024),
 * "Updated Schedule of Shuttle Bus Service", effective 1 June 2024.
 *
 * To change the timetable, edit the tables in this file only. app.js reads them.
 *
 * Day types
 *   wd  = Monday–Friday, not a public holiday
 *   sat = Saturday, not a public holiday
 *   sun = Sunday or Hong Kong general (public) holiday  -> no service
 */
(function (root) {
  'use strict';

  var STOPS = {
    dth: {
      name: 'Data Technology Hub', short: 'DTHub', zh: '數據技術中心',
      where: 'Data Technology Hub, Tseung Kwan O InnoPark'
    },
    tkl: {
      name: 'Tiu Keng Leng', short: 'Tiu Keng Leng', zh: '調景嶺公共運輸交匯處',
      where: 'Tiu Keng Leng Station Public Transport Interchange'
    },
    lt: {
      name: 'Lam Tin', short: 'Lam Tin', zh: '藍田港鐵站',
      where: 'Lam Tin MTR Station'
    }
  };

  var STOP_ORDER = ['dth', 'tkl', 'lt'];

  var LINES = {
    tkl: { name: 'Tiu Keng Leng route' },
    lt:  { name: 'Lam Tin route' }
  };

  // Each table: [days, departure times]. Times are departures from the first stop.
  var TIMETABLE = {
    tkl_to_dth: {
      line: 'tkl', from: 'tkl', to: 'dth',
      wd:  ['08:15', '08:45', '09:15', '09:55', '12:45', '13:50', '14:50', '16:15', '17:15', '17:50', '18:20', '18:50', '19:20'],
      sat: ['08:15', '08:45', '13:00']
    },
    dth_to_tkl: {
      line: 'tkl', from: 'dth', to: 'tkl',
      wd:  ['08:30', '09:00', '09:30', '09:40', '12:30', '13:35', '14:35', '16:00', '17:00', '17:35', '18:05', '18:35', '19:05', '19:35'],
      sat: ['08:30', '12:45', '13:15']
    },
    lt_to_dth: {
      line: 'lt', from: 'lt', to: 'dth',
      wd:  ['08:00', '08:40', '09:20', '11:30', '13:15', '18:00', '18:40', '19:20']
    },
    dth_to_lt: {
      line: 'lt', from: 'dth', to: 'lt',
      wd:  ['08:20', '09:00', '11:15', '13:00', '17:40', '18:20', '19:00', '19:40']
    }
  };

  var TRIPS = [];
  Object.keys(TIMETABLE).forEach(function (k) {
    var r = TIMETABLE[k];
    ['wd', 'sat', 'sun'].forEach(function (dt) {
      (r[dt] || []).forEach(function (t) {
        TRIPS.push({ line: r.line, mode: 'bus', days: [dt], stops: [[r.from, t], [r.to, null]], note: '' });
      });
    });
  });

  // ---- Hong Kong general holidays (no service) ---------------------------
  // Source: 1823 / GovHK general holiday calendar.
  var HOLIDAYS = {
    '2026-01-01': 'The first day of January',
    '2026-02-17': "Lunar New Year's Day",
    '2026-02-18': 'The second day of Lunar New Year',
    '2026-02-19': 'The third day of Lunar New Year',
    '2026-04-03': 'Good Friday',
    '2026-04-04': 'The day following Good Friday',
    '2026-04-06': 'The day following Ching Ming Festival',
    '2026-04-07': 'The day following Easter Monday',
    '2026-05-01': 'Labour Day',
    '2026-05-25': 'The day following the Birthday of the Buddha',
    '2026-06-19': 'Tuen Ng Festival',
    '2026-07-01': 'HKSAR Establishment Day',
    '2026-09-26': 'The day following Mid-Autumn Festival',
    '2026-10-01': 'National Day',
    '2026-10-19': 'The day following Chung Yeung Festival',
    '2026-12-25': 'Christmas Day',
    '2026-12-26': 'The first weekday after Christmas Day',
    '2027-01-01': 'The first day of January',
    '2027-02-06': "Lunar New Year's Day",
    '2027-02-08': 'The third day of Lunar New Year',
    '2027-02-09': 'The fourth day of Lunar New Year',
    '2027-03-26': 'Good Friday',
    '2027-03-27': 'The day following Good Friday',
    '2027-03-29': 'Easter Monday',
    '2027-04-05': 'Ching Ming Festival',
    '2027-05-01': 'Labour Day',
    '2027-05-13': 'The Birthday of the Buddha',
    '2027-06-09': 'Tuen Ng Festival',
    '2027-07-01': 'HKSAR Establishment Day',
    '2027-09-16': 'The day following Mid-Autumn Festival',
    '2027-10-01': 'National Day',
    '2027-10-08': 'Chung Yeung Festival',
    '2027-12-25': 'Christmas Day',
    '2027-12-27': 'The first weekday after Christmas Day'
  };
  var HOLIDAYS_UNTIL = '2027-12-31';

  var DATA = {
    source: 'Circular DTH/CIR/2024/01/044, effective 1 June 2024',
    home: 'dth',
    fare: 'HK$5 per person',
    stops: STOPS, stopOrder: STOP_ORDER, lines: LINES, trips: TRIPS,
    holidays: HOLIDAYS, holidaysUntil: HOLIDAYS_UNTIL
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.SHUTTLE_DATA = DATA;
})(this);
