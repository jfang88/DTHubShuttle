# DTHub Shuttle

A small static web app for the Data Technology Hub / Advanced Manufacturing Centre employees' shuttle bus in Tseung Kwan O InnoPark. Pick where you are and where you're going, and it shows the next bus, a countdown, and the rest of the day's departures. Works on phones and desktops; hosted on GitHub Pages.

**Live:** https://jfang88.github.io/DTHubShuttle/

## Routes

| Route | Days | Fare |
|---|---|---|
| DTHub ↔ Tiu Keng Leng Station Public Transport Interchange | Mon–Fri, plus 3 runs each way on Saturday | HK$5 |
| DTHub ↔ Lam Tin MTR Station | Mon–Fri | HK$5 |

No service on Sundays or public holidays.

## What it does

- **From / To pickers.** Defaults to departures from DTHub to any destination.
- **Next departure** with a countdown and where to wait.
- **Next to each stop**: one card per destination; tap one to set it.
- **Full day board** with past departures hidden (toggle "Show earlier"). When nothing is left today it rolls forward to the next service day, skipping Sundays and public holidays.
- **Pick a time** to plan a trip on any date.
- Always uses **Hong Kong time**, whatever the device's time zone.
- Remembers your last From/To. Links can preselect a route, e.g. `?from=tkl&to=dth` or `?from=dth&to=lt`.
- Installable to a phone home screen, and works offline once loaded.

Stop codes: `dth` Data Technology Hub, `tkl` Tiu Keng Leng, `lt` Lam Tin.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell |
| `styles.css` | Layout and theme (light and dark) |
| `data.js` | **The timetable and holiday list. Edit this to update times.** |
| `schedule.js` | Timetable logic (no DOM; runs in Node for testing) |
| `app.js` | UI |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline support and home-screen install |

No build step and no dependencies.

## Updating the timetable

Edit the `TIMETABLE` object in `data.js`: one entry per direction, with `wd` (Mon–Fri) and `sat` (Saturday) lists of departure times. Add the next year's Hong Kong general holidays to `HOLIDAYS` from [GovHK](https://www.gov.hk/en/about/abouthk/holiday/) or the [1823 calendar](https://www.1823.gov.hk/common/ical/en.json) and bump `HOLIDAYS_UNTIL`.

Quick check after editing:

```sh
node -e 'const D=require("./data.js"),S=require("./schedule.js");
const p=S.plan(D,"dth",null,"2026-10-13",S.toMin("14:00"));
p.upcoming.forEach(d=>console.log(d.time,"->",d.dests[0].stop))'
```

## Source

Timetable from circular DTH/CIR/2024/01/044 (24 May 2024), "Updated Schedule of Shuttle Bus Service", effective 1 June 2024. Route information is for reference only and subject to traffic conditions. Questions about the service: DTH Facilities Management Office, 2148 1228 or dth@innoparkhk.org.
