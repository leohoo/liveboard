# LiveBoard

A real-time dashboard for repurposing old iPads as home information displays. Built with ES5 JavaScript for Safari 9 compatibility (iPad 2, iOS 9.3.5).

## Features

- **Weather** - Current conditions and forecast from tenki.jp
- **Calendar** - Multiple iCal calendars with badges, recurring events, timezone support
- **Lunar Calendar** - Chinese lunar date display
- **Auto-dim** - Touch to wake (100% brightness), dims to day/night setting after 1 minute
- **Day/Night Mode** - Configurable brightness schedules
- **Real-time Updates** - Server-Sent Events (SSE) with auto-reconnect

## Screenshots

The dashboard displays weather, calendar events for today and tomorrow, and the current date with lunar calendar.

## Installation

```bash
git clone https://github.com/leohoo/liveboard.git
cd liveboard
npm install
```

## Configuration

### Set timezone (important!)

The server uses the system timezone. Set it on your Raspberry Pi:

```bash
sudo timedatectl set-timezone Asia/Tokyo
```

Or set `TZ` environment variable when starting:

```bash
TZ=Asia/Tokyo npm start
```

### Settings

Copy the default settings:

```bash
cp config/settings.default.json config/settings.json
```

Edit `config/settings.json`:

```json
{
  "calendars": [
    {
      "name": "Family",
      "badge": "👨‍👩‍👧‍👦",
      "url": "https://calendar.google.com/calendar/ical/xxx/basic.ics"
    }
  ],
  "weather": {
    "location": "東京",
    "tenkiPath": "/forecast/3/16/4410/13101/"
  },
  "display": {
    "dayBrightness": 100,
    "nightBrightness": 30,
    "dayStart": "07:00",
    "nightStart": "22:00"
  }
}
```

### Finding your tenki.jp path

1. Go to [tenki.jp](https://tenki.jp)
2. Search for your location
3. Copy the URL path (e.g., `/forecast/3/16/4410/13108/`)

### Getting iCal URLs

- **Google Calendar**: Settings > Calendar > Integrate calendar > Secret address in iCal format
- **Apple iCloud**: Calendar sharing > Public Calendar

## Usage

### Start the server

```bash
npm start
```

Open `http://<server-ip>:3000` on your iPad (e.g., `http://192.168.1.100:3000`).

### CLI Commands

```bash
# Show current settings
./bin/liveboard-cli show

# Calendar management
./bin/liveboard-cli calendar list
./bin/liveboard-cli calendar add <name> <badge> <url>
./bin/liveboard-cli calendar remove <name>
./bin/liveboard-cli calendar badge <name> <new-badge>
./bin/liveboard-cli calendar info

# Display settings
./bin/liveboard-cli set day 07:00
./bin/liveboard-cli set night 22:00
./bin/liveboard-cli set day-brightness 100
./bin/liveboard-cli set night-brightness 30

# Weather settings
./bin/liveboard-cli set location "東京"
./bin/liveboard-cli set tenki "/forecast/3/16/4410/13101/"

# Reload all connected dashboards
./bin/liveboard-cli reload

# Server status
./bin/liveboard-cli status
```

### Run as a service (Linux/Raspberry Pi)

```bash
sudo ./bin/liveboard-cli install
sudo ./bin/liveboard-cli uninstall
./bin/liveboard-cli logs
```

## Tech Stack

- **Server**: Node.js, Express, SSE
- **Client**: ES5 JavaScript (Safari 9 compatible)
- **Calendar**: ical.js for iCal parsing
- **Lunar**: lunar-javascript for Chinese lunar calendar

## License

MIT
