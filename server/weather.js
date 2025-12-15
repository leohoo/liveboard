/**
 * Weather fetching module
 * Fetches weather data from tenki.jp
 */

var https = require('https');
var timezone = require('./timezone');

var USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
var JST_OFFSET = -540; // JST = UTC+9

/**
 * Fetch hourly temperature from tenki.jp 1hour page
 * @param {string} tenkiPath - Base path (e.g., /forecast/3/16/4410/13108/)
 * @param {function} callback - Called with temperature (number) or null
 */
function fetchHourlyTemp(tenkiPath, callback) {
  var hourlyPath = tenkiPath.replace(/\/$/, '') + '/1hour.html';
  var options = {
    hostname: 'tenki.jp',
    path: hourlyPath,
    headers: { 'User-Agent': USER_AGENT }
  };

  https.get(options, function(res) {
    var html = '';
    res.on('data', function(chunk) { html += chunk; });
    res.on('end', function() {
      try {
        // Extract first temperatureData array (today's hourly temps)
        // Array index 0 = column "01" (00:00-01:00), index 23 = column "24" (23:00-24:00)
        var tempMatch = html.match(/var temperatureData = \[([0-9.,\s]+)\]/);
        if (tempMatch) {
          var temps = tempMatch[1].split(',').map(function(t) {
            return parseFloat(t.trim());
          });

          // Get current hour in JST (tenki.jp uses JST)
          var now = timezone.toClientTime(new Date(), JST_OFFSET);
          var currentHour = now.getHours();

          // Hour N (N:00-N:59) uses column N+1 (index N)
          // e.g., 10:30 is in period 10:00-11:00, labeled "11", index 10
          var index = currentHour;
          if (temps[index] !== undefined && !isNaN(temps[index])) {
            callback(temps[index]);
            return;
          }
        }
        callback(null);
      } catch (e) {
        console.error('Hourly temp parse error:', e);
        callback(null);
      }
    });
  }).on('error', function(e) {
    console.error('Hourly temp fetch error:', e);
    callback(null);
  });
}

/**
 * Fetch main weather forecast from tenki.jp
 * @param {string} tenkiPath - Base path (e.g., /forecast/3/16/4410/13108/)
 * @param {function} callback - Called with weather data object or null
 */
function fetchForecast(tenkiPath, callback) {
  var options = {
    hostname: 'tenki.jp',
    path: tenkiPath,
    headers: { 'User-Agent': USER_AGENT }
  };

  https.get(options, function(res) {
    var html = '';
    res.on('data', function(chunk) { html += chunk; });
    res.on('end', function() {
      try {
        var data = {};

        // Extract today's high/low
        var highMatch = html.match(/<dd class="high-temp temp">\s*<span class="value">([0-9-]+)<\/span>/);
        var lowMatch = html.match(/<dd class="low-temp temp">\s*<span class="value">([0-9-]+)<\/span>/);
        if (highMatch) data.high = highMatch[1];
        if (lowMatch) data.low = lowMatch[1];

        // Extract weather condition
        var conditionMatch = html.match(/weather-telop">([^<]+)/);
        if (conditionMatch) data.condition = conditionMatch[1].trim();

        // Extract tomorrow's weather from JavaScript data
        var tomorrowHighMatch = html.match(/"tomorrow_max_temp":"([0-9-]+)"/);
        var tomorrowLowMatch = html.match(/"tomorrow_min_temp":"([0-9-]+)"/);
        var tomorrowCondMatch = html.match(/"tomorrow_map_telop_forecast_telop":"([^"]+)"/);
        if (tomorrowHighMatch) data.tomorrowHigh = tomorrowHighMatch[1];
        if (tomorrowLowMatch) data.tomorrowLow = tomorrowLowMatch[1];
        if (tomorrowCondMatch) data.tomorrowCondition = tomorrowCondMatch[1];

        callback(data);
      } catch (e) {
        console.error('Weather parse error:', e);
        callback(null);
      }
    });
  }).on('error', function(e) {
    console.error('Weather fetch error:', e);
    callback(null);
  });
}

module.exports = {
  fetchForecast: fetchForecast,
  fetchHourlyTemp: fetchHourlyTemp
};
