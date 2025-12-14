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
│   └── index.js          # Express server, SSE, weather/calendar fetching
├── client/
│   ├── index.html        # Dashboard page
│   ├── admin.html        # Settings page
│   ├── styles/main.css   # Flexbox layout with -webkit- prefixes
│   └── scripts/app.js    # ES5 SSE client
├── config/
│   ├── settings.json     # User config (gitignored)
│   └── settings.default.json
├── bin/
│   └── liveboard-cli     # CLI for configuration
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

## Common Commands

```bash
npm start                           # Start server
./bin/liveboard-cli show            # Show settings
./bin/liveboard-cli calendar list   # List calendars
./bin/liveboard-cli reload          # Reload all clients
```
