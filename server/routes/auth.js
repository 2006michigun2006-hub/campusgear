import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { query } from '../db.js';
import { badRequest, HttpError } from '../errors.js';
import {
  SESSION_COOKIE, clearSessionCookie, createSession, destroySession, hashPassword,
  publicAccount, setSessionCookie, verifyPassword,
} from '../auth.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  return { email, password };
}

router.post('/register', limiter, async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const problems = [];
  if (!EMAIL_RE.test(email) || email.length > 200) problems.push('Enter a valid email address.');
  if (!name || name.length > 100) problems.push('Enter your name (up to 100 characters).');
  if (password.length < 8 || password.length > 200) problems.push('Password must be at least 8 characters.');
  if (problems.length) throw badRequest('Please fix the highlighted fields.', problems);

  const hash = await hashPassword(password);
  // Self-registration always creates a student; staff accounts are provisioned by the operator.
  const { rows } = await query(
    `INSERT INTO accounts(email, name, password_hash, role) VALUES ($1, $2, $3, 'student')
     ON CONFLICT (email) DO NOTHING RETURNING id, email, name, role`,
    [email, name, hash],
  );
  if (!rows[0]) throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  const token = await createSession(rows[0].id);
  setSessionCookie(res, token);
  res.status(201).json({ account: publicAccount(rows[0]) });
});

router.post('/login', limiter, async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const { rows } = await query('SELECT id, email, name, role, password_hash FROM accounts WHERE email = $1', [email]);
  const account = rows[0];
  const ok = account && password ? await verifyPassword(password, account.password_hash) : false;
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  const token = await createSession(account.id);
  setSessionCookie(res, token);
  res.json({ account: publicAccount(account) });
});

router.post('/logout', async (req, res) => {
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ account: publicAccount(req.account) });
});

export default router;
