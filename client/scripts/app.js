/* LiveBoard Client - ES5 Compatible */
(function() {
  'use strict';

  var widgetsContainer = document.getElementById('widgets');
  var statusEl = document.getElementById('status');
  var brightnessOverlay = document.getElementById('brightness-overlay');

  var eventSource = null;
  var reconnectAttempts = 0;
  var maxReconnectDelay = 30000;
  var widgets = {};

  // Auto-dim settings
  var dimTimeout = 60000; // 1 minute
  var serverBrightness = 100;
  var isBoosted = false; // true = 100% brightness from touch
  var dimTimer = null;

  // Initialize connection
  function connect() {
    if (eventSource) {
      eventSource.close();
    }

    setStatus('Connecting...', '');
    var tzOffset = new Date().getTimezoneOffset();
    eventSource = new EventSource('/events?tz=' + tzOffset);

    eventSource.onopen = function() {
      reconnectAttempts = 0;
      setStatus('Connected', 'connected');
    };

    eventSource.onerror = function() {
      eventSource.close();
      setStatus('Disconnected - Reconnecting...', 'error');
      scheduleReconnect();
    };

    // Handle config event
    eventSource.addEventListener('config', function(e) {
      var config = JSON.parse(e.data);
      renderWidgets(config.widgets);
    });

    // Handle update event
    eventSource.addEventListener('update', function(e) {
      var update = JSON.parse(e.data);
      updateWidget(update.id, update);
    });

    // Handle display event (brightness, etc.)
    eventSource.addEventListener('display', function(e) {
      var display = JSON.parse(e.data);
      if (display.brightness !== undefined) {
        setBrightness(display.brightness);
      }
    });

    // Handle reload event
    eventSource.addEventListener('reload', function(e) {
      window.location.reload(true);
    });
  }

  // Reconnect with exponential backoff
  function scheduleReconnect() {
    var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
    reconnectAttempts++;
    setTimeout(connect, delay);
  }

  // Update status display
  function setStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = className || '';
  }

  // Render all widgets from config
  function renderWidgets(widgetConfigs) {
    widgetsContainer.innerHTML = '';
    widgets = {};

    for (var i = 0; i < widgetConfigs.length; i++) {
      var config = widgetConfigs[i];
      var widget = createWidget(config);
      widgetsContainer.appendChild(widget);
      widgets[config.id] = widget;
    }
  }

  // Create a widget element
  function createWidget(config) {
    var widget = document.createElement('div');
    widget.className = 'widget widget-' + config.type;
    widget.id = 'widget-' + config.id;

    if (config.type === 'weather') {
      return createWeatherWidget(widget, config);
    }

    if (config.type === 'message') {
      return createMessageWidget(widget, config);
    }

    if (config.type === 'calendar') {
      return createCalendarWidget(widget, config);
    }

    if (config.type === 'date') {
      return createDateWidget(widget, config);
    }

    var value = document.createElement('div');
    value.className = 'widget-value';
    value.textContent = config.value || '--:--:--';
    widget.appendChild(value);

    if (config.title) {
      var title = document.createElement('div');
      title.className = 'widget-title';
      title.textContent = config.title;
      widget.appendChild(title);
    }

    return widget;
  }

  // Create date widget with lunar calendar
  function createDateWidget(widget, config) {
    var value = document.createElement('div');
    value.className = 'widget-value';
    value.textContent = config.value || '--';
    widget.appendChild(value);

    var lunar = document.createElement('div');
    lunar.className = 'widget-lunar';
    lunar.textContent = config.lunar || '';
    widget.appendChild(lunar);

    return widget;
  }

  // Create message widget
  function createMessageWidget(widget, config) {
    var text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = config.text || '';
    widget.appendChild(text);
    return widget;
  }

  // Create calendar widget
  function createCalendarWidget(widget, config) {
    // Today section
    var todaySection = document.createElement('div');
    todaySection.className = 'calendar-section';

    var todayTitle = document.createElement('div');
    todayTitle.className = 'calendar-title';
    todayTitle.textContent = '今日';
    todaySection.appendChild(todayTitle);

    var todayEvents = document.createElement('ul');
    todayEvents.className = 'calendar-events calendar-today-events';
    renderCalendarEvents(todayEvents, config.today || []);
    todaySection.appendChild(todayEvents);

    widget.appendChild(todaySection);

    // Tomorrow section
    var tomorrowSection = document.createElement('div');
    tomorrowSection.className = 'calendar-section calendar-tomorrow';

    var tomorrowTitle = document.createElement('div');
    tomorrowTitle.className = 'calendar-title';
    tomorrowTitle.textContent = '明日';
    tomorrowSection.appendChild(tomorrowTitle);

    var tomorrowEvents = document.createElement('ul');
    tomorrowEvents.className = 'calendar-events calendar-tomorrow-events';
    renderCalendarEvents(tomorrowEvents, config.tomorrow || []);
    tomorrowSection.appendChild(tomorrowEvents);

    widget.appendChild(tomorrowSection);

    return widget;
  }

  // Render calendar events list
  function renderCalendarEvents(container, events) {
    container.innerHTML = '';

    if (events.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'calendar-empty';
      empty.textContent = 'No events today';
      container.appendChild(empty);
      return;
    }

    for (var i = 0; i < events.length; i++) {
      var evt = events[i];
      var li = document.createElement('li');
      li.className = 'calendar-event';

      var time = document.createElement('span');
      time.className = 'event-time';
      time.textContent = evt.allDay ? '終日' : (evt.time || '');
      li.appendChild(time);

      var summary = document.createElement('span');
      summary.className = 'event-summary';
      summary.textContent = evt.summary || '';
      li.appendChild(summary);

      if (evt.badge) {
        var badge = document.createElement('span');
        badge.className = 'event-badge';
        badge.textContent = evt.badge;
        li.appendChild(badge);
      }

      container.appendChild(li);
    }
  }

  // Create weather widget
  function createWeatherWidget(widget, config) {
    var location = document.createElement('div');
    location.className = 'weather-location';
    location.textContent = config.location || '--';
    widget.appendChild(location);

    var temp = document.createElement('div');
    temp.className = 'weather-temp';
    temp.textContent = config.temp || '--';
    widget.appendChild(temp);

    var condition = document.createElement('div');
    condition.className = 'weather-condition';
    condition.textContent = config.condition || '--';
    widget.appendChild(condition);

    var highlow = document.createElement('div');
    highlow.className = 'weather-highlow';

    var high = document.createElement('span');
    high.className = 'weather-high';
    high.textContent = '↑ ' + (config.high || '--') + '°';
    highlow.appendChild(high);

    var low = document.createElement('span');
    low.className = 'weather-low';
    low.textContent = '↓ ' + (config.low || '--') + '°';
    highlow.appendChild(low);

    widget.appendChild(highlow);

    // Tomorrow's weather
    var tomorrowDiv = document.createElement('div');
    tomorrowDiv.className = 'weather-tomorrow';

    var tomorrowLabel = document.createElement('div');
    tomorrowLabel.className = 'weather-tomorrow-label';
    tomorrowLabel.textContent = '明日';
    tomorrowDiv.appendChild(tomorrowLabel);

    var tomorrowInfo = document.createElement('div');
    tomorrowInfo.className = 'weather-tomorrow-info';

    var tomorrowCond = document.createElement('span');
    tomorrowCond.className = 'weather-tomorrow-condition';
    tomorrowCond.textContent = (config.tomorrowCondition || '--') + ' ';
    tomorrowInfo.appendChild(tomorrowCond);

    var tomorrowHighLow = document.createElement('span');
    tomorrowHighLow.className = 'weather-tomorrow-highlow';
    tomorrowHighLow.innerHTML = '<span class="weather-high">↑' + (config.tomorrowHigh || '--') + '°</span> <span class="weather-low">↓' + (config.tomorrowLow || '--') + '°</span>';
    tomorrowInfo.appendChild(tomorrowHighLow);

    tomorrowDiv.appendChild(tomorrowInfo);
    widget.appendChild(tomorrowDiv);

    return widget;
  }

  // Update a single widget
  function updateWidget(id, data) {
    var widget = widgets[id];
    if (!widget) return;

    // Calendar widget update
    if (data.today !== undefined) {
      var todayEl = widget.querySelector('.calendar-today-events');
      if (todayEl) renderCalendarEvents(todayEl, data.today);
    }
    if (data.tomorrow !== undefined) {
      var tomorrowEl = widget.querySelector('.calendar-tomorrow-events');
      if (tomorrowEl) renderCalendarEvents(tomorrowEl, data.tomorrow);
    }

    // Weather widget update
    if (data.temp !== undefined) {
      var tempEl = widget.querySelector('.weather-temp');
      if (tempEl) tempEl.textContent = data.temp;
    }
    if (data.condition !== undefined) {
      var condEl = widget.querySelector('.weather-condition');
      if (condEl) condEl.textContent = data.condition;
    }
    if (data.high !== undefined) {
      var highEl = widget.querySelector('.weather-high');
      if (highEl) highEl.textContent = '↑ ' + data.high + '°';
    }
    if (data.low !== undefined) {
      var lowEl = widget.querySelector('.weather-low');
      if (lowEl) lowEl.textContent = '↓ ' + data.low + '°';
    }
    if (data.tomorrowCondition !== undefined) {
      var tCondEl = widget.querySelector('.weather-tomorrow-condition');
      if (tCondEl) tCondEl.textContent = data.tomorrowCondition + ' ';
    }
    if (data.tomorrowHigh !== undefined || data.tomorrowLow !== undefined) {
      var tHLEl = widget.querySelector('.weather-tomorrow-highlow');
      if (tHLEl) {
        tHLEl.innerHTML = '<span class="weather-high">↑' + (data.tomorrowHigh || '--') + '°</span> <span class="weather-low">↓' + (data.tomorrowLow || '--') + '°</span>';
      }
    }

    // Text/Date widget update
    if (data.value !== undefined) {
      var valueEl = widget.querySelector('.widget-value');
      if (valueEl) {
        valueEl.textContent = data.value;
      }
    }
    if (data.lunar !== undefined) {
      var lunarEl = widget.querySelector('.widget-lunar');
      if (lunarEl) {
        lunarEl.textContent = data.lunar;
      }
    }
  }

  // Set brightness (0-100, where 100 is full brightness)
  function setBrightness(level) {
    serverBrightness = level;
    applyBrightness();
  }

  // Apply current brightness (100% if boosted, otherwise server level)
  function applyBrightness() {
    var level = isBoosted ? 100 : serverBrightness;
    var opacity = 1 - (level / 100);
    brightnessOverlay.style.opacity = opacity;
  }

  // Reset dim timer on activity - boost to 100%
  function resetDimTimer() {
    isBoosted = true;
    applyBrightness();
    if (dimTimer) {
      clearTimeout(dimTimer);
    }
    dimTimer = setTimeout(function() {
      isBoosted = false;
      applyBrightness();
      window.scrollTo(0, 0);
    }, dimTimeout);
  }

  // Listen for touch/click to wake from dim
  document.addEventListener('click', resetDimTimer, false);
  document.addEventListener('touchstart', resetDimTimer, false);

  // Start dim timer
  resetDimTimer();

  // Start
  connect();
})();
