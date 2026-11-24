/**
 * Client profiles: which modules (widgets) each display shows.
 *
 * settings.json:
 *   "profiles": {
 *     "default": { "modules": ["date", "weather", "calendar"] },
 *     "office":  { "modules": ["date", "weather", "meters", "calendar"] }
 *   }
 *
 * A client picks its profile with /?profile=office. No profile, or an unknown
 * one, falls back to "default". Without a "profiles" block, "default" shows
 * the built-in modules, so existing setups keep working unchanged.
 */

var BUILTIN_DEFAULT = ['date', 'weather', 'calendar'];

function resolveProfile(settings, name) {
  var profiles = (settings && settings.profiles) || {};
  var key = name && Object.prototype.hasOwnProperty.call(profiles, name) ? name : 'default';
  var profile = profiles[key];
  var modules = profile && Array.isArray(profile.modules) ? profile.modules : BUILTIN_DEFAULT;
  return { name: key, modules: modules.slice() };
}

function hasModule(profile, moduleId) {
  return !!profile && profile.modules.indexOf(moduleId) !== -1;
}

module.exports = {
  BUILTIN_DEFAULT: BUILTIN_DEFAULT,
  resolveProfile: resolveProfile,
  hasModule: hasModule
};
