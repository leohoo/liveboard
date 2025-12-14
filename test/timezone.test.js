/**
 * Tests for timezone conversion utilities
 *
 * Ensures date/time displays correctly in client timezone regardless of server timezone.
 */

var timezone = require('../server/timezone');

console.log('=== Timezone Conversion Tests ===\n');

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

// Test: toClientTime with JST (UTC+9, offset -540)
test('toClientTime: UTC midnight to JST should be 9am same day', function() {
  // Server in UTC: Jan 15, 2024 00:00:00 UTC
  var serverDate = new Date(Date.UTC(2024, 0, 15, 0, 0, 0));
  var jstOffset = -540; // JST = UTC+9

  var clientDate = timezone.toClientTime(serverDate, jstOffset);

  assertEqual(clientDate.getHours(), 9, 'Hours');
  assertEqual(clientDate.getDate(), 15, 'Day');
  assertEqual(clientDate.getMonth(), 0, 'Month');
});

// Test: toClientTime with JST around midnight JST
test('toClientTime: 3pm UTC to JST should be midnight next day', function() {
  // Server: Jan 15, 2024 15:00:00 UTC = Jan 16, 2024 00:00:00 JST
  var serverDate = new Date(Date.UTC(2024, 0, 15, 15, 0, 0));
  var jstOffset = -540;

  var clientDate = timezone.toClientTime(serverDate, jstOffset);

  assertEqual(clientDate.getHours(), 0, 'Hours');
  assertEqual(clientDate.getDate(), 16, 'Day should be 16 (next day)');
});

// Test: toClientTime with null offset returns original date
test('toClientTime: null offset should return original date', function() {
  var serverDate = new Date(Date.UTC(2024, 0, 15, 12, 30, 0));
  var clientDate = timezone.toClientTime(serverDate, null);

  assertEqual(clientDate.getTime(), serverDate.getTime(), 'Should return same date');
});

// Test: formatDateJapanese
test('formatDateJapanese: formats correctly', function() {
  // Monday, Jan 15, 2024
  var date = new Date(2024, 0, 15, 12, 0, 0);
  var formatted = timezone.formatDateJapanese(date);

  assertEqual(formatted, '1月15日 (月)', 'Format');
});

// Test: formatDateJapanese for Sunday
test('formatDateJapanese: Sunday formatting', function() {
  // Sunday, Dec 15, 2024
  var date = new Date(2024, 11, 15, 12, 0, 0);
  var formatted = timezone.formatDateJapanese(date);

  assertEqual(formatted, '12月15日 (日)', 'Format');
});

// Test: Real scenario - server in UTC at 11pm, client in JST (next day)
test('Real scenario: UTC 11pm Dec 14 should show Dec 15 in JST', function() {
  // This is the actual bug scenario:
  // Server time: Dec 14, 2024 23:00 UTC
  // Client expects: Dec 15, 2024 08:00 JST
  var serverDate = new Date(Date.UTC(2024, 11, 14, 23, 0, 0));
  var jstOffset = -540;

  var clientDate = timezone.toClientTime(serverDate, jstOffset);
  var formatted = timezone.formatDateJapanese(clientDate);

  assertEqual(clientDate.getDate(), 15, 'Day should be 15 in JST');
  assertEqual(clientDate.getMonth(), 11, 'Month should be December');
  assertEqual(formatted, '12月15日 (日)', 'Formatted date');
});

// Test: Edge case - exactly midnight JST
test('Edge case: exactly midnight JST', function() {
  // Dec 15, 2024 00:00 JST = Dec 14, 2024 15:00 UTC
  var serverDate = new Date(Date.UTC(2024, 11, 14, 15, 0, 0));
  var jstOffset = -540;

  var clientDate = timezone.toClientTime(serverDate, jstOffset);

  assertEqual(clientDate.getHours(), 0, 'Hours should be 0');
  assertEqual(clientDate.getDate(), 15, 'Day should be 15');
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
