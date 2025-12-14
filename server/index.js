var express = require('express');
var path = require('path');
var https = require('https');
var fs = require('fs');
var Lunar = require('lunar-javascript').Lunar;
var calendar = require('./calendar');

var app = express();
var PORT = process.env.PORT || 3000;

// Config file path
var CONFIG_PATH = path.join(__dirname, '..', 'config', 'settings.json');
var CONFIG_DEFAULT_PATH = path.join(__dirname, '..', 'config', 'settings.default.json');

// Load settings
function loadSettings() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.copyFileSync(CONFIG_DEFAULT_PATH, CONFIG_PATH);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Error loading settings:', e);
    return JSON.parse(fs.readFileSync(CONFIG_DEFAULT_PATH, 'utf8'));
  }
}

// Save settings
function saveSettings(settings) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2));
}

var settings = loadSettings();

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use(express.json());

// Store connected clients
var clients = [];

// Client timezone offset (minutes from UTC, e.g., -540 for JST)
var clientTzOffset = null;

// Weather data cache
var weatherData = {
  temp: '--',
  high: '--',
  low: '--',
  condition: '--',
  tomorrowHigh: '--',
  tomorrowLow: '--',
  tomorrowCondition: '--',
  location: settings.weather.location
};

// Calendar data cache
var calendarEvents = { today: [], tomorrow: [] };

// Calculate current brightness based on schedule (using client timezone)
function getCurrentBrightness() {
  var now = new Date();

  // Convert to client timezone if available
  if (clientTzOffset !== null) {
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    now = new Date(utc - clientTzOffset * 60000);
  }

  var currentTime = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' +
                    (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();

  var dayStart = settings.display.dayStart || '07:00';
  var nightStart = settings.display.nightStart || '22:00';
  var dayBrightness = settings.display.dayBrightness || 100;
  var nightBrightness = settings.display.nightBrightness || 30;

  // Check if current time is during day hours
  if (currentTime >= dayStart && currentTime < nightStart) {
    return dayBrightness;
  }
  return nightBrightness;
}

// Broadcast brightness to all clients
function broadcastBrightness() {
  var brightness = getCurrentBrightness();
  clients.forEach(function(client) {
    sendEvent(client.res, 'display', { brightness: brightness });
  });
}

// Fetch calendar events from all configured calendars
function fetchCalendar() {
  var calendars = settings.calendars || [];
  if (calendars.length === 0) {
    console.log('No calendars configured');
    return;
  }

  var pending = calendars.length;
  var allEvents = { today: [], tomorrow: [] };

  calendars.forEach(function(cal) {
    if (!cal.url) {
      pending--;
      return;
    }

    https.get(cal.url, function(res) {
      res.setEncoding('utf8');
      var icsData = '';
      res.on('data', function(chunk) { icsData += chunk; });
      res.on('end', function() {
        try {
          var events = calendar.parseICS(icsData, cal.badge, clientTzOffset);
          allEvents.today = allEvents.today.concat(events.today);
          allEvents.tomorrow = allEvents.tomorrow.concat(events.tomorrow);
        } catch (e) {
          console.error('Calendar parse error (' + cal.name + '):', e);
        }

        pending--;
        if (pending === 0) {
          finishCalendarUpdate(allEvents);
        }
      });
    }).on('error', function(e) {
      console.error('Calendar fetch error (' + cal.name + '):', e.message);
      pending--;
      if (pending === 0) {
        finishCalendarUpdate(allEvents);
      }
    });
  });
}

// Finish calendar update - dedupe, sort, broadcast
function finishCalendarUpdate(allEvents) {
  // Deduplicate
  var dedupe = function(events) {
    var seen = {};
    return events.filter(function(evt) {
      var key = (evt.time || 'allday') + '|' + evt.summary + '|' + (evt.badge || '');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  };
  allEvents.today = dedupe(allEvents.today);
  allEvents.tomorrow = dedupe(allEvents.tomorrow);

  // Sort
  var sortFn = function(a, b) {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  };
  allEvents.today.sort(sortFn);
  allEvents.tomorrow.sort(sortFn);

  calendarEvents = allEvents;
  console.log('Calendar updated:', calendarEvents.today.length, 'today,', calendarEvents.tomorrow.length, 'tomorrow');
  broadcastCalendar();
}

// Broadcast calendar to all clients
function broadcastCalendar() {
  var update = {
    id: 'calendar',
    today: calendarEvents.today,
    tomorrow: calendarEvents.tomorrow
  };
  clients.forEach(function(client) {
    sendEvent(client.res, 'update', update);
  });
}

// Fetch weather from tenki.jp
function fetchWeather() {
  var options = {
    hostname: 'tenki.jp',
    path: settings.weather.tenkiPath,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  };

  https.get(options, function(res) {
    var html = '';
    res.on('data', function(chunk) { html += chunk; });
    res.on('end', function() {
      try {
        // Extract today's high/low (more flexible whitespace)
        var highMatch = html.match(/<dd class="high-temp temp">\s*<span class="value">([0-9-]+)<\/span>/);
        var lowMatch = html.match(/<dd class="low-temp temp">\s*<span class="value">([0-9-]+)<\/span>/);
        if (highMatch) weatherData.high = highMatch[1];
        if (lowMatch) weatherData.low = lowMatch[1];

        // Use high temp as current temp (current observation may not always be available)
        if (highMatch) weatherData.temp = highMatch[1];

        // Extract weather condition
        var conditionMatch = html.match(/weather-telop">([^<]+)/);
        if (conditionMatch) {
          weatherData.condition = conditionMatch[1].trim();
        }

        // Extract tomorrow's weather from JavaScript data
        var tomorrowHighMatch = html.match(/"tomorrow_max_temp":"([0-9-]+)"/);
        var tomorrowLowMatch = html.match(/"tomorrow_min_temp":"([0-9-]+)"/);
        var tomorrowCondMatch = html.match(/"tomorrow_map_telop_forecast_telop":"([^"]+)"/);
        if (tomorrowHighMatch) weatherData.tomorrowHigh = tomorrowHighMatch[1];
        if (tomorrowLowMatch) weatherData.tomorrowLow = tomorrowLowMatch[1];
        if (tomorrowCondMatch) weatherData.tomorrowCondition = tomorrowCondMatch[1];

        console.log('Weather updated:', weatherData);
        broadcastWeather();
      } catch (e) {
        console.error('Weather parse error:', e);
      }
    });
  }).on('error', function(e) {
    console.error('Weather fetch error:', e);
  });
}

// Broadcast weather to all clients
function broadcastWeather() {
  var update = {
    id: 'weather',
    temp: weatherData.temp,
    high: weatherData.high,
    low: weatherData.low,
    condition: weatherData.condition,
    tomorrowHigh: weatherData.tomorrowHigh,
    tomorrowLow: weatherData.tomorrowLow,
    tomorrowCondition: weatherData.tomorrowCondition,
    location: weatherData.location
  };
  clients.forEach(function(client) {
    sendEvent(client.res, 'update', update);
  });
}

// SSE endpoint
app.get('/events', function(req, res) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Capture client timezone offset
  var tz = req.query.tz;
  if (tz !== undefined && clientTzOffset === null) {
    clientTzOffset = parseInt(tz, 10);
    console.log('Client timezone offset:', clientTzOffset, 'minutes (UTC' + (clientTzOffset <= 0 ? '+' : '-') + Math.abs(clientTzOffset / 60) + ')');
    // Start calendar fetching now that we have timezone
    startCalendarFetching();
  }

  // Add client to list
  var clientId = Date.now();
  var client = { id: clientId, res: res };
  clients.push(client);
  console.log('Client connected:', clientId, '- Total clients:', clients.length);

  // Send initial config
  var config = {
    layout: 'single',
    widgets: [
      {
        id: 'date',
        type: 'date',
        value: ''
      },
      {
        id: 'weather',
        type: 'weather',
        temp: weatherData.temp,
        high: weatherData.high,
        low: weatherData.low,
        condition: weatherData.condition,
        tomorrowHigh: weatherData.tomorrowHigh,
        tomorrowLow: weatherData.tomorrowLow,
        tomorrowCondition: weatherData.tomorrowCondition,
        location: weatherData.location
      },
      {
        id: 'calendar',
        type: 'calendar',
        today: calendarEvents.today,
        tomorrow: calendarEvents.tomorrow
      }
    ]
  };
  sendEvent(res, 'config', config);

  // Send immediate date update
  sendDateUpdate(res);

  // Send current weather
  sendEvent(res, 'update', {
    id: 'weather',
    temp: weatherData.temp,
    high: weatherData.high,
    low: weatherData.low,
    condition: weatherData.condition,
    tomorrowHigh: weatherData.tomorrowHigh,
    tomorrowLow: weatherData.tomorrowLow,
    tomorrowCondition: weatherData.tomorrowCondition,
    location: weatherData.location
  });

  // Send current brightness
  sendEvent(res, 'display', { brightness: getCurrentBrightness() });

  // Keepalive every 15 seconds (Safari timeout prevention)
  var keepaliveInterval = setInterval(function() {
    res.write(':keepalive\n\n');
  }, 15000);

  // Clean up on disconnect
  req.on('close', function() {
    clearInterval(keepaliveInterval);
    clients = clients.filter(function(c) { return c.id !== clientId; });
    console.log('Client disconnected:', clientId, '- Total clients:', clients.length);
  });
});

// Health check
app.get('/status', function(req, res) {
  res.json({
    status: 'ok',
    clients: clients.length,
    uptime: process.uptime()
  });
});

// Force all clients to reload
app.post('/reload', function(req, res) {
  clients.forEach(function(client) {
    sendEvent(client.res, 'reload', {});
  });
  res.json({ reloaded: clients.length });
});

// Get settings (hide sensitive calendar URLs partially)
app.get('/api/settings', function(req, res) {
  var safeSettings = JSON.parse(JSON.stringify(settings));
  // Mask calendar URLs for display
  if (safeSettings.calendars) {
    safeSettings.calendars = safeSettings.calendars.map(function(cal) {
      return {
        name: cal.name,
        hasUrl: !!cal.url,
        url: cal.url ? '••••••••' + cal.url.slice(-20) : ''
      };
    });
  }
  res.json(safeSettings);
});

// Get full settings (for admin page editing)
app.get('/api/settings/full', function(req, res) {
  res.json(settings);
});

// Update settings
app.post('/api/settings', function(req, res) {
  try {
    var newSettings = req.body;

    // Validate structure
    if (!Array.isArray(newSettings.calendars) || !newSettings.weather || !newSettings.display) {
      return res.status(400).json({ error: 'Invalid settings structure' });
    }

    // Update settings
    settings = newSettings;
    saveSettings(settings);

    // Update weather location display
    weatherData.location = settings.weather.location;

    // Refetch data with new settings
    fetchWeather();
    fetchCalendar();

    // Update brightness immediately
    broadcastBrightness();

    res.json({ success: true });
  } catch (e) {
    console.error('Error saving settings:', e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Helper: Send SSE event
function sendEvent(res, event, data) {
  res.write('event: ' + event + '\n');
  res.write('data: ' + JSON.stringify(data) + '\n\n');
}

// Helper: Send date update
function sendDateUpdate(res) {
  var now = new Date();
  var days = ['日', '月', '火', '水', '木', '金', '土'];
  var month = now.getMonth() + 1;
  var day = now.getDate();
  var weekday = days[now.getDay()];

  var dateStr = month + '月' + day + '日 (' + weekday + ')';

  // Get lunar date (simplified Chinese)
  var lunar = Lunar.fromDate(now);
  var lunarStr = '农历 ' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese();

  var update = {
    id: 'date',
    value: dateStr,
    lunar: lunarStr
  };
  sendEvent(res, 'update', update);
}

// Broadcast date to all clients every minute
setInterval(function() {
  clients.forEach(function(client) {
    sendDateUpdate(client.res);
  });
}, 60000);

// Check brightness every minute (day/night transitions)
setInterval(broadcastBrightness, 60000);

// Fetch weather every 10 minutes
fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);

// Fetch calendar every 5 minutes (wait for first client to get timezone)
var calendarInterval = null;
function startCalendarFetching() {
  if (calendarInterval) return; // Already started
  fetchCalendar();
  calendarInterval = setInterval(fetchCalendar, 5 * 60 * 1000);
}

app.listen(PORT, function() {
  console.log('LiveBoard server running on http://localhost:' + PORT);
});
