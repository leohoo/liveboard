/**
 * Tests for client profile resolution
 */

var profiles = require('../server/profiles');

console.log('=== Profile Tests ===\n');

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(msg + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

var settings = {
  profiles: {
    'default': { modules: ['date', 'weather'] },
    desk: { modules: ['date', 'weather', 'calendar', 'quota'] }
  }
};

test('named profile is used', function() {
  var p = profiles.resolveProfile(settings, 'desk');
  assertEqual(p.name, 'desk', 'name');
  assertEqual(p.modules, ['date', 'weather', 'calendar', 'quota'], 'modules');
});

test('missing profile name falls back to default', function() {
  assertEqual(profiles.resolveProfile(settings, undefined).modules, ['date', 'weather'], 'modules');
});

test('unknown profile name falls back to default', function() {
  var p = profiles.resolveProfile(settings, 'kitchen');
  assertEqual(p.name, 'default', 'name');
  assertEqual(p.modules, ['date', 'weather'], 'modules');
});

test('inherited object keys are not profiles', function() {
  assertEqual(profiles.resolveProfile(settings, 'toString').name, 'default', 'name');
});

test('no profiles block shows built-in modules (no quota)', function() {
  var p = profiles.resolveProfile({}, 'desk');
  assertEqual(p.modules, ['date', 'weather', 'calendar'], 'modules');
  assertEqual(profiles.hasModule(p, 'quota'), false, 'quota hidden');
});

test('empty module list is honoured, not replaced by built-ins', function() {
  var p = profiles.resolveProfile({ profiles: { 'default': { modules: [] } } }, null);
  assertEqual(p.modules, [], 'modules');
});

test('hasModule', function() {
  var p = profiles.resolveProfile(settings, 'desk');
  assertEqual(profiles.hasModule(p, 'quota'), true, 'desk has quota');
  assertEqual(profiles.hasModule(profiles.resolveProfile(settings, null), 'quota'), false, 'default lacks quota');
});

test('returned modules are a copy', function() {
  profiles.resolveProfile(settings, 'desk').modules.push('x');
  assertEqual(settings.profiles.desk.modules.length, 4, 'settings untouched');
});

var failed = 0;
tests.forEach(function(t) {
  try {
    t.fn();
    console.log('✓ ' + t.name);
  } catch (e) {
    failed++;
    console.log('✗ ' + t.name + '\n  ' + e.message);
  }
});
console.log('\n' + (tests.length - failed) + '/' + tests.length + ' passed');
if (failed) process.exit(1);
