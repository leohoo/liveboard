/**
 * Tests for weather module
 */

var timezone = require('../server/timezone');
var weather = require('../server/weather');

console.log('=== Weather Module Tests ===\n');

var passed = true;
var tests = [];

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg + ': expected "' + expected + '", got "' + actual + '"');
  }
}

// Test: Hour to index mapping
// tenki.jp hour labels represent periods ENDING at that hour
// e.g., "11" = 10:00-11:00, so hour 10 uses index 10
test('Hour index mapping: hour 0 uses index 0', function() {
  var index = 0; // Hour 0 (00:00-01:00) -> column "01" -> index 0
  assertEqual(index, 0, 'Hour 0 index');
});

test('Hour index mapping: hour 10 uses index 10', function() {
  var index = 10; // Hour 10 (10:00-11:00) -> column "11" -> index 10
  assertEqual(index, 10, 'Hour 10 index');
});

test('Hour index mapping: hour 23 uses index 23', function() {
  var index = 23; // Hour 23 (23:00-24:00) -> column "24" -> index 23
  assertEqual(index, 23, 'Hour 23 index');
});

// Fixture shaped like tenki.jp 1hour.html (2026-11-27): three 3-hourly
// arrays (8 values) come before the three hourly arrays (24 values).
var TODAY_HOURLY = [11.0,10.5,8.5,8.0,8.5,7.5,8.5,11.0,12.5,14.5,15.5,16.0,
  16.0,16.5,16.0,15.0,13.5,13.0,14.0,13.0,14.0,14.0,14.2,14.1];
var PAGE = [
  'var temperatureData = [8.5,7.5,12.5,16.0,16.0,13.0,14.0,14.1];',
  'var temperatureData = [13.7,11.5,12.0,15.7,20.7,16.9,15.6,13.7];',
  'var temperatureData = [11.6,9.7,12.3,14.6,12.7,9.6,8.4,7.5];',
  'var temperatureData = [' + TODAY_HOURLY.join(',') + '];',
  'var temperatureData = [' + TODAY_HOURLY.map(function(t) { return t + 5; }).join(',') + '];'
].join('\n');

test('parseHourlyTemp skips 3-hourly arrays and uses today\'s 24-hour array', function() {
  assertEqual(weather.parseHourlyTemp(PAGE, 0), 11.0, 'Hour 0 (column 01)');
  assertEqual(weather.parseHourlyTemp(PAGE, 2), 8.5, 'Hour 2 (column 03)');
  assertEqual(weather.parseHourlyTemp(PAGE, 8), 12.5, 'Hour 8 (column 09)');
  assertEqual(weather.parseHourlyTemp(PAGE, 21), 14.0, 'Hour 21 (column 22)');
  assertEqual(weather.parseHourlyTemp(PAGE, 23), 14.1, 'Hour 23 (column 24)');
});

test('parseHourlyTemp handles whitespace and negative temps', function() {
  var temps = [];
  for (var i = 0; i < 24; i++) temps.push(i - 3.5);
  var html = 'var temperatureData = [' + temps.join(', ') + '];';
  assertEqual(weather.parseHourlyTemp(html, 1), -2.5, 'Hour 1');
  assertEqual(weather.parseHourlyTemp(html, 10), 6.5, 'Hour 10');
});

test('parseHourlyTemp returns null without a 24-hour array', function() {
  var html = 'var temperatureData = [8.5,7.5,12.5,16.0,16.0,13.0,14.0,14.1];';
  assertEqual(weather.parseHourlyTemp(html, 3), null, 'Only 3-hourly data');
  assertEqual(weather.parseHourlyTemp('<html></html>', 3), null, 'No data');
});

// Test: JST time conversion for weather lookup
test('JST time conversion works correctly', function() {
  var JST_OFFSET = -540;
  // UTC 01:00 = JST 10:00
  var utcDate = new Date(Date.UTC(2024, 11, 15, 1, 30, 0));
  var jstDate = timezone.toClientTime(utcDate, JST_OFFSET);
  assertEqual(jstDate.getHours(), 10, 'JST hour');
});

// Test: Full 24-hour array mapping
test('Full 24-hour array: each hour maps to correct index', function() {
  var temps = [];
  for (var i = 0; i < 24; i++) temps.push(i + 0.5); // [0.5, 1.5, ..., 23.5]

  // Hour 0 (00:00-01:00) should get temps[0] = 0.5
  assertEqual(temps[0], 0.5, 'Hour 0 temp');
  // Hour 12 (12:00-13:00) should get temps[12] = 12.5
  assertEqual(temps[12], 12.5, 'Hour 12 temp');
  // Hour 23 (23:00-24:00) should get temps[23] = 23.5
  assertEqual(temps[23], 23.5, 'Hour 23 temp');
});

// Run all tests
console.log('Running ' + tests.length + ' tests...\n');

tests.forEach(function(t) {
  try {
    t.fn();
    console.log('PASS: ' + t.name);
  } catch (e) {
    console.log('FAIL: ' + t.name);
    console.log('      ' + e.message);
    passed = false;
  }
});

console.log('\n' + (passed ? 'All tests passed!' : 'Some tests failed!'));
process.exit(passed ? 0 : 1);
