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
        var now = timezone.toClientTime(new Date(), JST_OFFSET);
        var temp = parseHourlyTemp(html, now.getHours());
        if (temp === null) console.error('Hourly temp: no 24-hour temperatureData for hour ' + now.getHours());
        callback(temp);
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
 * Pick the current hour's temperature from the tenki.jp 1hour.html page.
 * The page holds 3-hourly arrays (8 values per day) before the hourly ones
 * (24 values per day); the first 24-value array is today's.
 * Index 0 = column "01" (00:00-01:00), so hour N (N:00-N:59) uses index N.
 * @param {string} html - Page HTML
 * @param {number} hour - Current hour in JST (0-23)
 * @returns {number|null}
 */
function parseHourlyTemp(html, hour) {
  var re = /var temperatureData = \[([0-9.,\s-]+)\]/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var temps = m[1].split(',').map(function(t) { return parseFloat(t.trim()); });
    if (temps.length === 24) {
      return isNaN(temps[hour]) ? null : temps[hour];
    }
  }
  return null;
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
  fetchHourlyTemp: fetchHourlyTemp,
  parseHourlyTemp: parseHourlyTemp
};
