# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LiveBoard is a real-time dashboard for repurposing old iPads (iOS 9.3.5, Safari 9) as home information displays. Uses Server-Sent Events (SSE) for push updates.

## Architecture

- **Server**: Node.js + Express with SSE push
- **Client**: ES5 JavaScript (Safari 9 compatible), passive renderer
- **Communication**: Unidirectional SSE (server → client)

## Repository Structure

```
liveboard/
├── server/
│   ├── index.js          # Express server, SSE endpoints
│   ├── calendar.js       # ICS parsing with performance optimizations
│   ├── weather.js        # Weather fetching from tenki.jp
│   └── timezone.js       # Timezone conversion utilities
├── client/
│   ├── index.html        # Dashboard page
│   ├── styles/main.css   # Flexbox layout with -webkit- prefixes
│   └── scripts/app.js    # ES5 SSE client
├── config/
│   ├── settings.json     # User config (gitignored)
│   └── settings.default.json
├── bin/
│   └── liveboard-cli     # CLI for configuration
├── test/
│   ├── calendar.test.js  # Calendar parsing tests
│   ├── timezone.test.js  # Timezone conversion tests
│   └── weather.test.js   # Weather module tests
└── package.json
```

## Critical Browser Constraints (Safari 9)

- **ES5 only**: No arrow functions, const/let, template literals, destructuring, classes
- **No Fetch API**: Use XMLHttpRequest
- **No CSS Grid**: Use flexbox with `-webkit-` prefixes
- **SSE supported**: EventSource API works

## API Endpoints

- `GET /` - Dashboard page
- `GET /events` - SSE endpoint (config, update, display, reload events)
- `GET /api/settings` - Get settings (calendar URLs masked)
- `POST /api/settings` - Update settings
- `POST /reload` - Force all clients to reload
- `GET /status` - Health check

## Key Libraries

- `ical.js` - iCal parsing with RRULE expansion
- `lunar-javascript` - Chinese lunar calendar

## Performance Notes

### Calendar Parsing (server/calendar.js)

Large calendars (1000+ events) can cause CPU spikes on Raspberry Pi. Two optimizations:

1. **Pre-filter past events**: Skip single events in the past and recurring events with UNTIL before today. Avoids creating expensive ICAL.Event objects.

2. **Skip past occurrences**: Don't pass start time to iterator (corrupts event times). Instead, skip past occurrences with continue/break.

```javascript
// Pre-filter (cheap check on raw vevent)
if (!rruleProp && startDate < todayStart) return; // Skip past single events
if (rruleVal.until && untilDate < todayStart) return; // Skip ended recurrences

// Iterator - don't pass start time (would cause all times to show 00:00)
var iter = event.iterator();
while ((next = iter.next()) && count < maxIterations) {
  if (jsDate < todayStart) continue; // Skip past occurrences
  if (jsDate >= dayAfterStart) break; // Stop after tomorrow
  // Process event...
}
```

Before: 4223 events → 108 seconds, 100% CPU
After: 4223 events → ~4 seconds, then idle

### Weather Fetching (server/weather.js)

Fetches weather data from tenki.jp (Japanese weather service, JST-based).

- **fetchForecast()**: Main forecast page - high/low temps, conditions
- **fetchHourlyTemp()**: 1-hour forecast page - current hour temperature

Hour label mapping for hourly data:
- Labels represent periods ENDING at that hour (e.g., "11" = 10:00-11:00)
- Array index = current hour (simple direct mapping)
- Uses JST time regardless of server timezone

```javascript
// tenki.jp 1hour.html: temperatureData[0] = column "01" (00:00-01:00)
var index = currentHour;  // Hour 10 (10:00-11:00) → index 10 → column "11"
```

## Git Workflow

- Use squash merge for PRs

## Common Commands

```bash
npm start                           # Start server
npm test                            # Run tests
./bin/liveboard-cli show            # Show settings
./bin/liveboard-cli calendar list   # List calendars
./bin/liveboard-cli reload          # Reload all clients
```
