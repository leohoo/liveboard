/**
 * Test for calendar parsing performance
 *
 * Ensures recurring events don't cause CPU spikes by iterating through
 * years of past occurrences.
 */

var calendar = require('../server/calendar');

// Build a Date at least `minutesFromNow` in the future, clamped to stay
// within today (so tests don't roll into tomorrow) and to survive the
// app's "hide events that ended more than 1 hour ago" cutoff regardless of
// what time of day the test suite happens to run.
function futureTodayAt(minutesFromNow) {
  var d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + minutesFromNow);
  var endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0);
  return d > endOfDay ? endOfDay : d;
}

function formatICSTime(d) {
  var year = d.getFullYear();
  var month = (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
  var day = (d.getDate() < 10 ? '0' : '') + d.getDate();
  var hour = (d.getHours() < 10 ? '0' : '') + d.getHours();
  var min = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  return year + month + day + 'T' + hour + min + '00';
}

function formatClockTime(d) {
  var hour = (d.getHours() < 10 ? '0' : '') + d.getHours();
  var min = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  return hour + ':' + min;
}

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

  // Rescheduled occurrence must land "today" and stay within the app's
  // 1-hour-after-end display window, regardless of what time the test runs.
  var rescheduledStart = futureTodayAt(120);
  var rescheduledEnd = futureTodayAt(150);
  var rescheduledDate = formatICSTime(rescheduledStart);

  var ics = [
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
    'DTEND;TZID=Asia/Tokyo:' + formatICSTime(rescheduledEnd),
    'SUMMARY:Rescheduled Meeting',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return { ics: ics, expectedTime: formatClockTime(rescheduledStart) };
}

var exceptionData = createRescheduledExceptionICS();
var exceptionICS = exceptionData.ics;
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

if (rescheduledEvent && rescheduledEvent.time === exceptionData.expectedTime) {
  console.log('PASS: Event time is correct (' + exceptionData.expectedTime + ')');
} else {
  console.log('FAIL: Event time should be ' + exceptionData.expectedTime + ', got:', rescheduledEvent ? rescheduledEvent.time : 'N/A');
  passed = false;
}

console.log('\n' + (passed ? 'All tests passed!' : 'Some tests failed!'));

// Test 3: Declined RSVP is hidden
console.log('\n=== Declined RSVP Test ===\n');

var OWNER_EMAIL = 'owner@example.com';

// Event time must land "today" and stay within the app's 1-hour-after-end
// display window, regardless of what time the test runs.
var todayStart = formatICSTime(futureTodayAt(120));
var todayEnd = formatICSTime(futureTodayAt(150));

function createDeclinedSingleEventICS() {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:test-declined-single',
    'DTSTART;TZID=Asia/Tokyo:' + todayStart,
    'DTEND;TZID=Asia/Tokyo:' + todayEnd,
    'SUMMARY:Declined Meetup',
    'ATTENDEE;PARTSTAT=DECLINED:mailto:' + OWNER_EMAIL,
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:test-accepted-single',
    'DTSTART;TZID=Asia/Tokyo:' + todayStart,
    'DTEND;TZID=Asia/Tokyo:' + todayEnd,
    'SUMMARY:Accepted Meetup',
    'ATTENDEE;PARTSTAT=ACCEPTED:mailto:' + OWNER_EMAIL,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

var declinedICS = createDeclinedSingleEventICS();
var declinedResultFiltered = calendar.parseICS(declinedICS, 'test', -540, OWNER_EMAIL);
var declinedResultUnfiltered = calendar.parseICS(declinedICS, 'test', -540, null);

console.log('Test: Single event declined by calendar owner is hidden when ownerEmail is passed\n');

if (!declinedResultFiltered.today.some(function(e) { return e.summary === 'Declined Meetup'; })) {
  console.log('PASS: Declined event is hidden when filtering by owner email');
} else {
  console.log('FAIL: Declined event should be hidden');
  passed = false;
}

if (declinedResultFiltered.today.some(function(e) { return e.summary === 'Accepted Meetup'; })) {
  console.log('PASS: Accepted event still shows');
} else {
  console.log('FAIL: Accepted event should still show');
  passed = false;
}

if (declinedResultUnfiltered.today.some(function(e) { return e.summary === 'Declined Meetup'; })) {
  console.log('PASS: Without ownerEmail, declined event is shown (backward compatible)');
} else {
  console.log('FAIL: Without ownerEmail, declined event should still show');
  passed = false;
}

console.log('\n' + (passed ? 'All tests passed!' : 'Some tests failed!'));

// Test 4: Recurrence exception with no RSVP data inherits the series' decline
console.log('\n=== Declined Series + Exception Test ===\n');

function createDeclinedSeriesWithExceptionICS() {
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

  // Rescheduled occurrence must land "today" and stay within the app's
  // 1-hour-after-end display window, regardless of what time the test runs.
  var rescheduledStart = formatICSTime(futureTodayAt(120));
  var rescheduledEnd = formatICSTime(futureTodayAt(150));

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:test-declined-series-with-exception',
    'DTSTART;TZID=Asia/Tokyo:' + startDate,
    'DTEND;TZID=Asia/Tokyo:' + startDate.replace('160000', '163000'),
    'RRULE:FREQ=DAILY;UNTIL=' + untilDate,
    'SUMMARY:Declined Series',
    'ATTENDEE;PARTSTAT=DECLINED:mailto:' + OWNER_EMAIL,
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:test-declined-series-with-exception',
    'RECURRENCE-ID;TZID=Asia/Tokyo:' + originalOccurrence,
    'DTSTART;TZID=Asia/Tokyo:' + rescheduledStart,
    'DTEND;TZID=Asia/Tokyo:' + rescheduledEnd,
    'SUMMARY:Rescheduled Occurrence (no RSVP data of its own)',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

var declinedSeriesICS = createDeclinedSeriesWithExceptionICS();
var declinedSeriesResult = calendar.parseICS(declinedSeriesICS, 'test', -540, OWNER_EMAIL);

console.log('Test: Owner declined the whole series; a rescheduled exception with no RSVP data of its own should stay hidden\n');
console.log('Results:');
console.log('  Events found today:', declinedSeriesResult.today.length);

if (!declinedSeriesResult.today.some(function(e) { return e.summary.indexOf('Rescheduled Occurrence') === 0; })) {
  console.log('PASS: Exception occurrence inherits the series decline and stays hidden');
} else {
  console.log('FAIL: Exception occurrence without its own RSVP data should inherit the series decline');
  passed = false;
}

console.log('\n' + (passed ? 'All tests passed!' : 'Some tests failed!'));
process.exit(passed ? 0 : 1);
