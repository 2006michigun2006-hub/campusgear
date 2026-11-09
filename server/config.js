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
  // US-03 email sign-in links.
  // Links are built from a fixed base URL in production so a forged Host header cannot redirect them.
  publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || (isProd ? `http://localhost:${int('PORT', 3000)}` : '')).replace(/\/+$/, ''),
  linkMinutes: int('SIGNIN_LINK_MINUTES', 15),
  resendApiKey: env.RESEND_API_KEY || '',
  mailFrom: env.MAIL_FROM || 'CampusGear <onboarding@resend.dev>',
  logSigninLinks: env.LOG_SIGNIN_LINKS ? env.LOG_SIGNIN_LINKS === 'true' : !isProd,
  // Request log (S3-11) and data retention (E-07).
  logRequests: env.LOG_REQUESTS ? env.LOG_REQUESTS === 'true' : !isTest,
  historyRetentionDays: int('HISTORY_RETENTION_DAYS', 0), // 0 = keep history (retention rule still TBD)
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
