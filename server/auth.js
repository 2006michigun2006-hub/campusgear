import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { query } from './db.js';
import { forbidden, unauthorized } from './errors.js';

const scrypt = promisify(scryptCb);
const KEYLEN = 64;
export const SESSION_COOKIE = 'cg_session';

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/** Creates a session row and returns the raw token (only the hash is stored). */
export async function createSession(accountId, db = { query }) {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sessions(token_hash, account_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), accountId, config.sessionDays],
  );
  return token;
}

export async function destroySession(token) {
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.sessionDays * 86400000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });
}

/** Attaches req.account ({id, email, name, role}) when a valid session cookie is present. */
export async function loadSession(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  req.account = null;
  if (token) {
    const { rows } = await query(
      `SELECT a.id, a.email, a.name, a.role
         FROM sessions s JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)],
    );
    req.account = rows[0] || null;
  }
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.account) throw unauthorized();
  if (!roles.includes(req.account.role)) throw forbidden();
  next();
};

export const publicAccount = (a) => (a ? { id: a.id, email: a.email, name: a.name, role: a.role } : null);
