/**
 * Calendar parsing module
 * Parses ICS data and returns today's and tomorrow's events
 */

var ICAL = require('ical.js');

/**
 * Parse ICS format using ical.js and return today's and tomorrow's events
 * @param {string} icsData - Raw ICS calendar data
 * @param {string} badge - Optional badge to attach to events
 * @param {number|null} tzOffset - Timezone offset in minutes (e.g., -540 for JST)
 * @returns {{today: Array, tomorrow: Array}} Events for today and tomorrow
 */
function parseICS(icsData, badge, tzOffset) {
  var result = { today: [], tomorrow: [] };

  // Use provided timezone or fall back to server timezone
  if (tzOffset === undefined || tzOffset === null) {
    tzOffset = new Date().getTimezoneOffset();
  }

  // Helper: get date components in client's timezone
  function toClientTime(d) {
    var utc = d.getTime() + d.getTimezoneOffset() * 60000;
    return new Date(utc - tzOffset * 60000);
  }

  // Helper: format date as YYYYMMDD in client timezone
  function dateStr(d) {
    var ct = toClientTime(d);
    return ct.getFullYear() +
      (ct.getMonth() + 1 < 10 ? '0' : '') + (ct.getMonth() + 1) +
      (ct.getDate() < 10 ? '0' : '') + ct.getDate();
  }

  // Helper: format time as HH:MM in client timezone
  function timeStr(d) {
    var ct = toClientTime(d);
    var h = ct.getHours();
    var m = ct.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  // Get today and tomorrow in client timezone
  var now = new Date();
  var clientNow = toClientTime(now);

  // Format today/tomorrow as YYYYMMDD strings
  var todayStr = clientNow.getFullYear() +
    (clientNow.getMonth() + 1 < 10 ? '0' : '') + (clientNow.getMonth() + 1) +
    (clientNow.getDate() < 10 ? '0' : '') + clientNow.getDate();

  var tomorrowDate = new Date(clientNow);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  var tomorrowStr = tomorrowDate.getFullYear() +
    (tomorrowDate.getMonth() + 1 < 10 ? '0' : '') + (tomorrowDate.getMonth() + 1) +
    (tomorrowDate.getDate() < 10 ? '0' : '') + tomorrowDate.getDate();

  // Calculate UTC timestamps for today/tomorrow boundaries in client timezone
  var todayStart = new Date(Date.UTC(clientNow.getFullYear(), clientNow.getMonth(), clientNow.getDate()) + tzOffset * 60000);
  var dayAfterStart = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);

  // Cutoff: hide events that ended more than 1 hour ago
  var hideCutoff = new Date(now.getTime() - 60 * 60 * 1000);

  // Parse with ical.js
  var jcalData = ICAL.parse(icsData);
  var vcalendar = new ICAL.Component(jcalData);
  var vevents = vcalendar.getAllSubcomponents('vevent');

  // Track recurrence exceptions (RECURRENCE-ID events)
  var exceptions = {};
  vevents.forEach(function(vevent) {
    var recurrenceId = vevent.getFirstPropertyValue('recurrence-id');
    if (recurrenceId) {
      var uid = vevent.getFirstPropertyValue('uid');
      if (!exceptions[uid]) exceptions[uid] = {};
      exceptions[uid][recurrenceId.toString()] = vevent;
    }
  });

  vevents.forEach(function(vevent) {
    // Skip recurrence exceptions (handled separately)
    if (vevent.getFirstPropertyValue('recurrence-id')) return;

    var event = new ICAL.Event(vevent);
    var uid = event.uid;
    var summary = event.summary || '(No title)';
    var isAllDay = event.startDate.isDate;

    // Get event duration for calculating end time
    var duration = event.duration;

    // Check if recurring
    if (event.isRecurring()) {
      // Start iterator from today to avoid iterating through years of past events
      var iterStart = ICAL.Time.fromJSDate(todayStart, false);
      var iter = event.iterator(iterStart);
      var maxIterations = 100; // Safety limit (only need today + tomorrow)
      var count = 0;

      var next;
      while ((next = iter.next()) && count < maxIterations) {
        count++;
        var jsDate = next.toJSDate();
        var occDateStr = dateStr(jsDate);

        // Stop if past our range
        if (jsDate >= dayAfterStart) break;

        // Check for exception (modified occurrence)
        var exceptionEvent = exceptions[uid] && exceptions[uid][next.toString()];
        var endDate;
        if (exceptionEvent) {
          // Use the modified event instead
          var exEvent = new ICAL.Event(exceptionEvent);
          summary = exEvent.summary || summary;
          jsDate = exEvent.startDate.toJSDate();
          occDateStr = dateStr(jsDate);
          isAllDay = exEvent.startDate.isDate;
          endDate = exEvent.endDate ? exEvent.endDate.toJSDate() : jsDate;
        } else {
          // Calculate end time from duration
          if (duration) {
            endDate = new Date(jsDate.getTime() + duration.toSeconds() * 1000);
          } else {
            endDate = jsDate; // No duration, use start time
          }
        }

        // Skip if event ended more than 1 hour ago (only for today's events)
        if (occDateStr === todayStr && !isAllDay && endDate < hideCutoff) {
          continue;
        }

        var targetList = occDateStr === todayStr ? result.today :
                         occDateStr === tomorrowStr ? result.tomorrow : null;

        if (targetList) {
          var evt = { summary: summary, allDay: isAllDay };
          if (badge) evt.badge = badge;
          if (!isAllDay) evt.time = timeStr(jsDate);
          targetList.push(evt);
        }
      }
    } else {
      // Single event
      var jsDate = event.startDate.toJSDate();
      var evtDateStr = dateStr(jsDate);

      // Calculate end time
      var endDate;
      if (event.endDate) {
        endDate = event.endDate.toJSDate();
      } else if (duration) {
        endDate = new Date(jsDate.getTime() + duration.toSeconds() * 1000);
      } else {
        endDate = jsDate;
      }

      // Skip if event ended more than 1 hour ago (only for today's events)
      if (evtDateStr === todayStr && !isAllDay && endDate < hideCutoff) {
        return;
      }

      var targetList = evtDateStr === todayStr ? result.today :
                       evtDateStr === tomorrowStr ? result.tomorrow : null;

      if (targetList) {
        var evt = { summary: summary, allDay: isAllDay };
        if (badge) evt.badge = badge;
        if (!isAllDay) evt.time = timeStr(jsDate);
        targetList.push(evt);
      }
    }
  });

  return result;
}

module.exports = {
  parseICS: parseICS
};
