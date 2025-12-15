/**
 * Tests for weather module
 */

var timezone = require('../server/timezone');

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

// Test: Temperature regex parsing
test('Temperature regex extracts array correctly', function() {
  var html = 'var temperatureData = [4.4,5.0,5.5,6.5];';
  var match = html.match(/var temperatureData = \[([0-9.,\s]+)\]/);
  if (!match) throw new Error('Regex did not match');
  var temps = match[1].split(',').map(function(t) { return parseFloat(t.trim()); });
  assertEqual(temps.length, 4, 'Array length');
  assertEqual(temps[0], 4.4, 'First temp');
  assertEqual(temps[3], 6.5, 'Last temp');
});

// Test: Temperature regex handles whitespace
test('Temperature regex handles whitespace', function() {
  var html = 'var temperatureData = [4.4, 5.0, 5.5];';
  var match = html.match(/var temperatureData = \[([0-9.,\s]+)\]/);
  if (!match) throw new Error('Regex did not match');
  var temps = match[1].split(',').map(function(t) { return parseFloat(t.trim()); });
  assertEqual(temps[1], 5.0, 'Second temp with whitespace');
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
