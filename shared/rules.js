// Pilot loan rules (Part 1, "System design and loan rules").
// These are provisional until desk and IT staff confirm them; every value can be
// overridden with environment variables on the server (see server/config.js).
import { campusDateKey, daysBetweenKeys, dateKey, zonedParts } from './time.js';

export const DEFAULT_RULES = Object.freeze({
  timeZone: 'Asia/Almaty',
  openHour: 9, // first pickup hour, campus time
  closeHour: 17, // desk closes; latest return time
  weekdaysOnly: true,
  minLeadDays: 1, // bookings 1–14 days ahead
  maxLeadDays: 14,
  minHours: 1, // loans of 1–72 hours
  maxHours: 72,
});

const HOUR = 3600000;

/**
 * Validates a requested loan interval. Returns a list of human-readable problems
 * (empty when the interval is acceptable).
 */
export function validateInterval(start, end, now, rules = DEFAULT_RULES) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) {
    return ['Start and end must be valid date-times.'];
  }
  const tz = rules.timeZone;
  const errors = [];
  const s = zonedParts(start, tz);
  const e = zonedParts(end, tz);

  if (s.minute !== 0 || s.second !== 0 || start.getUTCMilliseconds() !== 0) errors.push('Pickup must start on the hour.');
  if (e.minute !== 0 || e.second !== 0 || end.getUTCMilliseconds() !== 0) errors.push('Return must be on the hour.');

  const hours = (end - start) / HOUR;
  if (hours <= 0) errors.push('Return must be after pickup.');
  else if (hours < rules.minHours || hours > rules.maxHours) {
    errors.push(`A loan must last between ${rules.minHours} and ${rules.maxHours} hours.`);
  }

  const lead = daysBetweenKeys(campusDateKey(now, tz), dateKey(s));
  if (lead < rules.minLeadDays || lead > rules.maxLeadDays) {
    errors.push(`Pickup must be ${rules.minLeadDays}–${rules.maxLeadDays} days from today.`);
  }

  if (rules.weekdaysOnly && s.weekday > 5) errors.push('Pickup must be on a weekday (Mon–Fri).');
  if (rules.weekdaysOnly && e.weekday > 5) errors.push('Return must be on a weekday (Mon–Fri).');
  if (s.hour < rules.openHour || s.hour > rules.closeHour - 1) {
    errors.push(`Pickup must be between ${rules.openHour}:00 and ${rules.closeHour - 1}:00.`);
  }
  if (e.hour < rules.openHour || e.hour > rules.closeHour) {
    errors.push(`Return must be between ${rules.openHour}:00 and ${rules.closeHour}:00.`);
  }
  return errors;
}
