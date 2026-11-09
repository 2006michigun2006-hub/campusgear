import { DEFAULT_RULES } from '../shared/rules.js';

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

function int(name, fallback) {
  if (env[name] === undefined || env[name] === '') return fallback;
  const n = Number(env[name]);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
  return n;
}

if (isProd && !env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production');
}

export const config = {
  isProd,
  isTest,
  port: int('PORT', 3000),
  databaseUrl: env.DATABASE_URL || 'postgres://campusgear:campusgear@localhost:55432/campusgear',
  // Render's internal connection string needs no TLS; external providers (Neon, Render external URL) do.
  databaseSsl: env.DATABASE_SSL === 'true',
  sessionDays: int('SESSION_DAYS', 7),
  seedDemo: env.SEED_DEMO !== 'false',
  staffEmail: (env.STAFF_EMAIL || 'staff@campusgear.test').toLowerCase(),
  staffPassword: env.STAFF_PASSWORD || (isProd ? '' : 'staff-demo-pass'),
  demoStudentEmail: (env.DEMO_STUDENT_EMAIL || 'student@campusgear.test').toLowerCase(),
  demoStudentPassword: env.DEMO_STUDENT_PASSWORD || (isProd ? '' : 'student-demo-pass'),
  rules: Object.freeze({
    timeZone: env.CAMPUS_TZ || DEFAULT_RULES.timeZone,
    openHour: int('OPEN_HOUR', DEFAULT_RULES.openHour),
    closeHour: int('CLOSE_HOUR', DEFAULT_RULES.closeHour),
    weekdaysOnly: env.WEEKDAYS_ONLY ? env.WEEKDAYS_ONLY !== 'false' : DEFAULT_RULES.weekdaysOnly,
    minLeadDays: int('MIN_LEAD_DAYS', DEFAULT_RULES.minLeadDays),
    maxLeadDays: int('MAX_LEAD_DAYS', DEFAULT_RULES.maxLeadDays),
    minHours: int('MIN_LOAN_HOURS', DEFAULT_RULES.minHours),
    maxHours: int('MAX_LOAN_HOURS', DEFAULT_RULES.maxHours),
  }),
};
