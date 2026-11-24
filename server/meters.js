/**
 * Meters: generic "percent left" gauges pushed from another machine.
 *
 * Nothing here knows what is being measured. A pusher (for example a job on
 * a laptop that reads AI subscription quotas) POSTs the whole set to
 * /api/push/meters, replacing the previous one:
 *
 *   {
 *     "updatedAt": "2026-11-24T16:42:00+09:00",
 *     "groups": [
 *       { "name": "Claude", "status": "ok",
 *         "rows": [ { "label": "5-hour", "percent": 83,
 *                     "resetsAt": "2026-11-24T15:19:00+09:00" } ] },
 *       { "name": "Codex", "status": "error", "rows": [] }
 *     ]
 *   }
 *
 * percent is the share LEFT (0-100). resetsAt is optional. A group with
 * status "error" is shown as unavailable while the other groups keep their
 * rows.
 *
 * Push is off unless settings.json has "meters": { "push": true }.
 */

var LIMITS = {
  groups: 6,
  rows: 8,
  name: 40,
  label: 40
};

function isString(v, max) {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}

function parseTime(v) {
  if (typeof v !== 'string' || v.length > 40) return null;
  var t = Date.parse(v);
  return isFinite(t) ? t : null;
}

// Returns { value: normalized } or { error: message }
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'body must be an object' };
  }
  var updatedAt = parseTime(body.updatedAt);
  if (updatedAt === null) return { error: 'updatedAt must be an ISO 8601 time' };
  if (!Array.isArray(body.groups) || body.groups.length === 0 || body.groups.length > LIMITS.groups) {
    return { error: 'groups must be an array of 1-' + LIMITS.groups };
  }

  var groups = [];
  for (var i = 0; i < body.groups.length; i++) {
    var g = body.groups[i];
    var where = 'groups[' + i + ']';
    if (!g || typeof g !== 'object') return { error: where + ' must be an object' };
    if (!isString(g.name, LIMITS.name)) return { error: where + '.name must be 1-' + LIMITS.name + ' characters' };
    if (g.status !== 'ok' && g.status !== 'error') return { error: where + '.status must be "ok" or "error"' };
    var rawRows = g.rows === undefined ? [] : g.rows;
    if (!Array.isArray(rawRows) || rawRows.length > LIMITS.rows) {
      return { error: where + '.rows must be an array of at most ' + LIMITS.rows };
    }
    if (g.status === 'ok' && rawRows.length === 0) return { error: where + ' has status "ok" but no rows' };

    var rows = [];
    for (var j = 0; j < rawRows.length; j++) {
      var r = rawRows[j];
      var rw = where + '.rows[' + j + ']';
      if (!r || typeof r !== 'object') return { error: rw + ' must be an object' };
      if (!isString(r.label, LIMITS.label)) return { error: rw + '.label must be 1-' + LIMITS.label + ' characters' };
      if (typeof r.percent !== 'number' || !isFinite(r.percent) || r.percent < 0 || r.percent > 100) {
        return { error: rw + '.percent must be a number from 0 to 100' };
      }
      var row = { label: r.label, percent: r.percent };
      if (r.resetsAt !== undefined && r.resetsAt !== null) {
        var resetsAt = parseTime(r.resetsAt);
        if (resetsAt === null) return { error: rw + '.resetsAt must be an ISO 8601 time' };
        row.resetsAt = resetsAt;
      }
      rows.push(row);
    }
    groups.push({ name: g.name, status: g.status, rows: g.status === 'ok' ? rows : [] });
  }

  // Times are normalized to epoch milliseconds for the client
  return { value: { updatedAt: updatedAt, groups: groups } };
}

// Holds the latest accepted set. Older pushes are rejected so a delayed
// retry can't overwrite newer data.
function createStore() {
  var current = null;
  return {
    get: function() { return current; },
    push: function(body) {
      var result = validate(body);
      if (result.error) return { status: 400, error: result.error };
      if (current && result.value.updatedAt < current.updatedAt) {
        return { status: 409, error: 'updatedAt is older than the stored meters' };
      }
      current = result.value;
      return { status: 200, value: current };
    }
  };
}

module.exports = {
  LIMITS: LIMITS,
  validate: validate,
  createStore: createStore
};
