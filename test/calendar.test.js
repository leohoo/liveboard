/**
 * Test for calendar parsing performance
 *
 * Ensures recurring events don't cause CPU spikes by iterating through
 * years of past occurrences.
 */

var calendar = require('../server/calendar');

// Create a recurring event that started 5 years ago with daily recurrence
function createOldRecurringICS() {
  var fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  var dtstart = fiveYearsAgo.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:test-recurring-event',
    'DTSTART:' + dtstart,
    'DTEND:' + dtstart,
    'RRULE:FREQ=DAILY',
    'SUMMARY:Daily Standup',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

// Run tests
console.log('=== Calendar Parsing Performance Test ===\n');

var icsData = createOldRecurringICS();
console.log('Test: Recurring event starting 5 years ago (1825+ occurrences)\n');

// Test the actual parseICS function
var start = Date.now();
var result = calendar.parseICS(icsData, 'test', -540); // JST timezone
var elapsed = Date.now() - start;

console.log('Results:');
console.log('  Events found today:', result.today.length);
console.log('  Events found tomorrow:', result.tomorrow.length);
console.log('  Time:', elapsed + 'ms');

// Assertions
console.log('\n=== Assertions ===\n');

var passed = true;
var totalEvents = result.today.length + result.tomorrow.length;
var anyEvent = result.today[0] || result.tomorrow[0];

if (elapsed < 100) {
  console.log('PASS: Parsing completes quickly (' + elapsed + 'ms < 100ms)');
} else {
  console.log('FAIL: Parsing too slow (' + elapsed + 'ms >= 100ms)');
  passed = false;
}

if (totalEvents >= 1) {
  console.log('PASS: Found events (' + totalEvents + ' total)');
} else {
  console.log('FAIL: Should find at least 1 event');
  passed = false;
}

if (anyEvent && anyEvent.summary === 'Daily Standup') {
  console.log('PASS: Event summary is correct');
} else {
  console.log('FAIL: Event summary should be "Daily Standup"');
  passed = false;
}

if (anyEvent && anyEvent.badge === 'test') {
  console.log('PASS: Badge is attached');
} else {
  console.log('FAIL: Badge should be "test"');
  passed = false;
}

console.log('\n' + (passed ? 'All tests passed!' : 'Some tests failed!'));

// Test 2: Rescheduled recurrence exception
console.log('\n=== Rescheduled Recurrence Exception Test ===\n');

// Create a recurring event that ended yesterday, but with an exception rescheduled to today
function createRescheduledExceptionICS() {
  var today = new Date();
  var yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  var twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  function formatDate(d) {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  function formatDateLocal(d) {
    var year = d.getFullYear();
    var month = (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
    var day = (d.getDate() < 10 ? '0' : '') + d.getDate();
    return year + month + day + 'T160000';
  }

  var startDate = formatDateLocal(twoDaysAgo);
  var untilDate = formatDate(yesterday);
  var originalOccurrence = formatDateLocal(yesterday);
  var rescheduledDate = formatDateLocal(today);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:test-recurring-with-exception',
    'DTSTART;TZID=Asia/Tokyo:' + startDate,
    'DTEND;TZID=Asia/Tokyo:' + startDate.replace('160000', '163000'),
    'RRULE:FREQ=DAILY;UNTIL=' + untilDate,
    'SUMMARY:Original Meeting',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:test-recurring-with-exception',
    'RECURRENCE-ID;TZID=Asia/Tokyo:' + originalOccurrence,
    'DTSTART;TZID=Asia/Tokyo:' + rescheduledDate,
    'DTEND;TZID=Asia/Tokyo:' + rescheduledDate.replace('160000', '163000'),
    'SUMMARY:Rescheduled Meeting',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

var exceptionICS = createRescheduledExceptionICS();
var exceptionResult = calendar.parseICS(exceptionICS, 'test', -540);

console.log('Test: Recurrence ended yesterday, but one occurrence rescheduled to today\n');
console.log('Results:');
console.log('  Events found today:', exceptionResult.today.length);
exceptionResult.today.forEach(function(e) {
  console.log('    -', e.time || 'allday', e.summary);
});

console.log('\n=== Assertions ===\n');

var rescheduledEvent = exceptionResult.today.find(function(e) {
  return e.summary === 'Rescheduled Meeting';
});

if (rescheduledEvent) {
  console.log('PASS: Rescheduled exception event found');
} else {
  console.log('FAIL: Rescheduled exception event should appear in today\'s events');
  passed = false;
}

if (rescheduledEvent && rescheduledEvent.time === '16:00') {
  console.log('PASS: Event time is correct (16:00)');
} else {
  console.log('FAIL: Event time should be 16:00, got:', rescheduledEvent ? rescheduledEvent.time : 'N/A');
  passed = false;
}

console.log('\n' + (passed ? 'All tests passed!' : 'Some tests failed!'));
process.exit(passed ? 0 : 1);
