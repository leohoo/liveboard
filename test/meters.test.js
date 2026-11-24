/**
 * Tests for pushed meters validation and storage
 */

var meters = require('../server/meters');

console.log('=== Meters Tests ===\n');

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(msg + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function body(overrides) {
  var b = {
    updatedAt: '2026-11-24T16:42:00+09:00',
    groups: [
      { name: 'Claude', status: 'ok', rows: [
        { label: '5-hour', percent: 83, resetsAt: '2026-11-24T15:19:00+09:00' },
        { label: 'Weekly', percent: 51 }
      ] },
      { name: 'Codex', status: 'error', rows: [] }
    ]
  };
  for (var k in overrides) b[k] = overrides[k];
  return b;
}

function rejects(b, fragment) {
  var r = meters.validate(b);
  if (!r.error) throw new Error('expected rejection containing "' + fragment + '", got ' + JSON.stringify(r));
  if (r.error.indexOf(fragment) === -1) throw new Error('error "' + r.error + '" lacks "' + fragment + '"');
}

test('valid body is normalized to epoch milliseconds', function() {
  var r = meters.validate(body({}));
  assertEqual(r.error, undefined, 'error');
  assertEqual(r.value.updatedAt, Date.parse('2026-11-24T16:42:00+09:00'), 'updatedAt');
  assertEqual(r.value.groups[0].rows[0], { label: '5-hour', percent: 83, resetsAt: Date.parse('2026-11-24T15:19:00+09:00') }, 'row with reset');
  assertEqual(r.value.groups[0].rows[1], { label: 'Weekly', percent: 51 }, 'row without reset');
  assertEqual(r.value.groups[1], { name: 'Codex', status: 'error', rows: [] }, 'error group');
});

test('unknown fields are dropped', function() {
  var b = body({ extra: 1 });
  b.groups[0].rows[0].html = '<b>';
  var r = meters.validate(b);
  assertEqual(r.value.extra, undefined, 'top-level extra');
  assertEqual(r.value.groups[0].rows[0].html, undefined, 'row extra');
});

test('percent boundaries 0 and 100 are accepted', function() {
  var b = body({});
  b.groups[0].rows[0].percent = 0;
  b.groups[0].rows[1].percent = 100;
  assertEqual(meters.validate(b).error, undefined, 'error');
});

test('percent out of range or not finite is rejected', function() {
  [-1, 100.5, NaN, Infinity, '50', null].forEach(function(p) {
    var b = body({});
    b.groups[0].rows[0].percent = p;
    rejects(b, 'percent');
  });
});

test('bad updatedAt is rejected', function() {
  rejects(body({ updatedAt: 'yesterday' }), 'updatedAt');
  rejects(body({ updatedAt: 1764000000000 }), 'updatedAt');
});

test('bad resetsAt is rejected, null resetsAt is allowed', function() {
  var b = body({});
  b.groups[0].rows[0].resetsAt = 'soon';
  rejects(b, 'resetsAt');
  b.groups[0].rows[0].resetsAt = null;
  assertEqual(meters.validate(b).value.groups[0].rows[0].resetsAt, undefined, 'null reset');
});

test('group and row counts are bounded', function() {
  rejects(body({ groups: [] }), 'groups');
  var many = [];
  for (var i = 0; i <= meters.LIMITS.groups; i++) many.push({ name: 'g' + i, status: 'error' });
  rejects(body({ groups: many }), 'groups');
  var rows = [];
  for (var j = 0; j <= meters.LIMITS.rows; j++) rows.push({ label: 'r' + j, percent: 1 });
  rejects(body({ groups: [{ name: 'g', status: 'ok', rows: rows }] }), 'rows');
});

test('string lengths are bounded', function() {
  var long = new Array(meters.LIMITS.name + 2).join('x');
  rejects(body({ groups: [{ name: long, status: 'error' }] }), 'name');
  rejects(body({ groups: [{ name: '', status: 'error' }] }), 'name');
  var b = body({});
  b.groups[0].rows[0].label = new Array(meters.LIMITS.label + 2).join('x');
  rejects(b, 'label');
});

test('status must be ok or error, and ok needs rows', function() {
  rejects(body({ groups: [{ name: 'g', status: 'warn', rows: [] }] }), 'status');
  rejects(body({ groups: [{ name: 'g', status: 'ok', rows: [] }] }), 'no rows');
});

test('non-object bodies are rejected', function() {
  rejects(null, 'object');
  rejects([], 'object');
  rejects('x', 'object');
});

test('store keeps the latest and rejects older pushes', function() {
  var store = meters.createStore();
  assertEqual(store.get(), null, 'empty store');
  assertEqual(store.push(body({})).status, 200, 'first push');
  var older = store.push(body({ updatedAt: '2026-11-24T16:00:00+09:00' }));
  assertEqual(older.status, 409, 'older push');
  assertEqual(store.get().updatedAt, Date.parse('2026-11-24T16:42:00+09:00'), 'kept newer');
  assertEqual(store.push(body({ updatedAt: '2026-11-24T16:42:00+09:00' })).status, 200, 'same time accepted');
  assertEqual(store.push(body({ updatedAt: '2026-11-24T17:00:00+09:00' })).status, 200, 'newer push');
  assertEqual(store.get().updatedAt, Date.parse('2026-11-24T17:00:00+09:00'), 'replaced');
});

test('invalid push leaves the store unchanged', function() {
  var store = meters.createStore();
  store.push(body({}));
  var r = store.push(body({ groups: [] }));
  assertEqual(r.status, 400, 'status');
  assertEqual(store.get().groups.length, 2, 'unchanged');
});

var passed = 0, failed = 0;
tests.forEach(function(t) {
  try { t.fn(); console.log('✓ ' + t.name); passed++; }
  catch (e) { console.log('✗ ' + t.name + '\n  ' + e.message); failed++; }
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
