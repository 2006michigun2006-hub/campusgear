import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, validateInterval } from '../shared/rules.js';
import { campusDateKey, zonedParts, zonedToUtc } from '../shared/time.js';

const tz = DEFAULT_RULES.timeZone;
// Wednesday 2026-11-18 12:00 campus time is "now" for these cases.
const now = zonedToUtc({ year: 2026, month: 11, day: 18, hour: 12 }, tz);
const at = (day, hour, month = 11) => zonedToUtc({ year: 2026, month, day, hour }, tz);

test('zone round-trip keeps wall-clock time', () => {
  const d = at(20, 9);
  assert.deepEqual({ ...zonedParts(d, tz), weekday: undefined }, { year: 2026, month: 11, day: 20, hour: 9, minute: 0, second: 0, weekday: undefined });
  assert.equal(campusDateKey(d, tz), '2026-11-20');
});

test('accepts a valid weekday loan inside handoff hours', () => {
  assert.deepEqual(validateInterval(at(19, 10), at(19, 12), now), []);
  assert.deepEqual(validateInterval(at(20, 16), at(23, 9), now), []); // Fri 16:00 → Mon 09:00 (65 h)
});

test('rejects same-day, too far ahead and weekend pickups', () => {
  assert.match(validateInterval(at(18, 14), at(18, 15), now).join(), /days from today/);
  assert.match(validateInterval(at(3, 10, 12), at(3, 11, 12), now).join(), /days from today/); // 15 days ahead
  assert.match(validateInterval(at(21, 10), at(21, 11), now).join(), /weekday/); // Saturday
});

test('rejects bad hours, lengths and partial hours', () => {
  assert.match(validateInterval(at(19, 8), at(19, 10), now).join(), /Pickup must be between/);
  assert.match(validateInterval(at(19, 16), at(19, 18), now).join(), /Return must be between/);
  assert.match(validateInterval(at(19, 10), at(19, 10), now).join(), /after pickup/);
  assert.match(validateInterval(at(23, 9), at(27, 10), now).join(), /between 1 and 72 hours/);
  const half = new Date(at(19, 10).getTime() + 30 * 60000);
  assert.match(validateInterval(half, at(19, 12), now).join(), /on the hour/);
  assert.deepEqual(validateInterval(new Date('nope'), at(19, 12), now), ['Start and end must be valid date-times.']);
});
