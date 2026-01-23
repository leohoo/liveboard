var express = require('express');
var path = require('path');
var https = require('https');
var fs = require('fs');
var Lunar = require('lunar-javascript').Lunar;
var calendar = require('./calendar');
var timezone = require('./timezone');
var weather = require('./weather');

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
  var now = timezone.toClientTime(new Date(), clientTzOffset);

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
  var deadClients = [];
  clients.forEach(function(client) {
    if (!sendEvent(client.res, 'display', { brightness: brightness })) {
      deadClients.push(client.id);
    }
  });
  if (deadClients.length > 0) {
    clients = clients.filter(function(c) { return deadClients.indexOf(c.id) === -1; });
    console.log('Removed', deadClients.length, 'dead client(s) - Total clients:', clients.length);
  }
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
  // Deduplicate and merge badges from different calendars
  var dedupe = function(events) {
    var seen = {};
    var result = [];
    events.forEach(function(evt) {
      var key = (evt.time || 'allday') + '|' + evt.summary;
      if (seen[key]) {
        // Merge badge if not already included
        if (evt.badge && seen[key].badge.indexOf(evt.badge) === -1) {
          seen[key].badge = seen[key].badge + '·' + evt.badge;
        }
      } else {
        var merged = { summary: evt.summary, allDay: evt.allDay };
        if (evt.time) merged.time = evt.time;
        merged.badge = evt.badge || '';
        seen[key] = merged;
        result.push(merged);
      }
    });
    return result;
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
  var deadClients = [];
  clients.forEach(function(client) {
    if (!sendEvent(client.res, 'update', update)) {
      deadClients.push(client.id);
    }
  });
  if (deadClients.length > 0) {
    clients = clients.filter(function(c) { return deadClients.indexOf(c.id) === -1; });
    console.log('Removed', deadClients.length, 'dead client(s) - Total clients:', clients.length);
  }
}

// Fetch weather from tenki.jp
function fetchWeather() {
  var tenkiPath = settings.weather.tenkiPath;

  weather.fetchForecast(tenkiPath, function(data) {
    if (data) {
      if (data.high) weatherData.high = data.high;
      if (data.low) weatherData.low = data.low;
      if (data.condition) weatherData.condition = data.condition;
      if (data.tomorrowHigh) weatherData.tomorrowHigh = data.tomorrowHigh;
      if (data.tomorrowLow) weatherData.tomorrowLow = data.tomorrowLow;
      if (data.tomorrowCondition) weatherData.tomorrowCondition = data.tomorrowCondition;
    }

    // Fetch hourly temperature for current temp
    weather.fetchHourlyTemp(tenkiPath, function(currentTemp) {
      if (currentTemp !== null) {
        weatherData.temp = String(currentTemp);
      } else if (data && data.high) {
        // Fallback to high temp if hourly fetch fails
        weatherData.temp = data.high;
      }

      console.log('Weather updated:', weatherData);
      broadcastWeather();
    });
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
  var deadClients = [];
  clients.forEach(function(client) {
    if (!sendEvent(client.res, 'update', update)) {
      deadClients.push(client.id);
    }
  });
  if (deadClients.length > 0) {
    clients = clients.filter(function(c) { return deadClients.indexOf(c.id) === -1; });
    console.log('Removed', deadClients.length, 'dead client(s) - Total clients:', clients.length);
  }
}

// SSE endpoint
app.get('/events', function(req, res) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
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
    try {
      sendEvent(res, 'keepalive', { timestamp: Date.now() });
    } catch (e) {
      console.error('Keepalive error for client', clientId, ':', e.message);
      clearInterval(keepaliveInterval);
      clients = clients.filter(function(c) { return c.id !== clientId; });
    }
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
  var reloaded = 0;
  var deadClients = [];
  clients.forEach(function(client) {
    if (sendEvent(client.res, 'reload', {})) {
      reloaded++;
    } else {
      deadClients.push(client.id);
    }
  });
  if (deadClients.length > 0) {
    clients = clients.filter(function(c) { return deadClients.indexOf(c.id) === -1; });
  }
  res.json({ reloaded: reloaded, failed: deadClients.length });
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

// Helper: Send SSE event (returns false on error)
function sendEvent(res, event, data) {
  try {
    res.write('event: ' + event + '\n');
    res.write('data: ' + JSON.stringify(data) + '\n\n');
    return true;
  } catch (e) {
    return false;
  }
}

// Helper: Send date update (using client timezone)
function sendDateUpdate(res) {
  var now = timezone.toClientTime(new Date(), clientTzOffset);
  var dateStr = timezone.formatDateJapanese(now);

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
  var deadClients = [];
  clients.forEach(function(client) {
    try {
      sendDateUpdate(client.res);
    } catch (e) {
      deadClients.push(client.id);
    }
  });
  if (deadClients.length > 0) {
    clients = clients.filter(function(c) { return deadClients.indexOf(c.id) === -1; });
    console.log('Removed', deadClients.length, 'dead client(s) from date update - Total clients:', clients.length);
  }
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
