// Time-zone helpers shared by the server and the browser.
// All instants are stored and transferred in UTC; campus rules are evaluated in
// the campus time zone (one zone for the whole pilot, see US-02).

const formatterCache = new Map();
const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function formatter(timeZone) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock parts of an instant in the given zone. weekday: Mon=1 … Sun=7. */
export function zonedParts(date, timeZone) {
  const p = {};
  for (const part of formatter(timeZone).formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS[p.weekday],
  };
}

function offsetMs(ts, timeZone) {
  const p = zonedParts(new Date(ts), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Converts a campus wall-clock time to a UTC Date. */
export function zonedToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMs(guess, timeZone);
  return new Date(guess - offsetMs(first, timeZone));
}

const pad = (n) => String(n).padStart(2, '0');

export function dateKey({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function campusDateKey(date, timeZone) {
  return dateKey(zonedParts(date, timeZone));
}

export function addDaysToKey(key, n) {
  const { year, month, day } = parseKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return dateKey({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

export function weekdayOfKey(key) {
  const { year, month, day } = parseKey(key);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // Sun=0
  return js === 0 ? 7 : js;
}

export function daysBetweenKeys(fromKey, toKey) {
  const a = parseKey(fromKey);
  const b = parseKey(toKey);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
}
