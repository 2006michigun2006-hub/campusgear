import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { query } from '../db.js';
import { badRequest, HttpError } from '../errors.js';
import {
  SESSION_COOKIE, clearSessionCookie, createSession, destroySession, hashPassword, hashToken,
  publicAccount, setSessionCookie, verifyPassword,
} from '../auth.js';
import { mailEnabled, sendSignInLink } from '../mail.js';

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
  await destroySession(req.cookies?.[SESSION_COOKIE]);
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
  await destroySession(req.cookies?.[SESSION_COOKIE]); // a new sign-in never reuses an old session
  const token = await createSession(account.id);
  setSessionCookie(res, token);
  res.json({ account: publicAccount(account) });
});

// US-03: single-use email sign-in link.
// The answer is the same whether or not the address has an account, so it cannot be used to
// find out who is registered. Outside production the link is also returned, for local testing.
router.post('/link', limiter, async (req, res) => {
  const { email } = readCredentials(req.body);
  if (!EMAIL_RE.test(email) || email.length > 200) throw badRequest('Enter a valid email address.');
  if (!mailEnabled()) {
    throw new HttpError(503, 'LINK_UNAVAILABLE', 'Email sign-in is not available yet. Please sign in with your password.');
  }
  const minutes = config.linkMinutes;
  const reply = { ok: true, minutes, message: `If an account exists for ${email}, we have sent it a sign-in link. The link works once and expires in ${minutes} minutes.` };

  const { rows } = await query('SELECT id, name FROM accounts WHERE email = $1', [email]);
  const account = rows[0];
  if (account) {
    const token = randomBytes(32).toString('base64url');
    // A new link replaces any unused older one.
    await query('DELETE FROM login_links WHERE account_id = $1 AND used_at IS NULL', [account.id]);
    await query(
      `INSERT INTO login_links(token_hash, account_id, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [hashToken(token), account.id, minutes],
    );
    // The token sits in the URL fragment, so it never reaches server or proxy logs.
    const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
    const url = `${base}/#/signin/${token}`;
    try {
      await sendSignInLink({ to: email, name: account.name, url, minutes });
    } catch (err) {
      // Same reply as for an unknown address; the failure is visible in the server log.
      console.error('[mail] could not send sign-in link:', err.message);
    }
    if (!config.isProd) reply.devLink = url;
  }
  res.json(reply);
});

router.post('/link/verify', limiter, async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const hash = hashToken(token);
  const { rows } = await query(
    'SELECT account_id, used_at, expires_at <= now() AS expired FROM login_links WHERE token_hash = $1',
    [hash],
  );
  const link = rows[0];
  if (!token || !link) throw new HttpError(400, 'LINK_INVALID', 'This sign-in link is not valid. Request a new one.');
  if (link.used_at) throw new HttpError(410, 'LINK_USED', 'This sign-in link has already been used. Request a new one.');
  if (link.expired) throw new HttpError(410, 'LINK_EXPIRED', 'This sign-in link has expired. Request a new one.');

  // Mark as used atomically: of two simultaneous clicks only one gets a session.
  const used = await query(
    `UPDATE login_links SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING account_id`,
    [hash],
  );
  if (!used.rows[0]) throw new HttpError(410, 'LINK_USED', 'This sign-in link has already been used. Request a new one.');

  await destroySession(req.cookies?.[SESSION_COOKIE]);
  const { rows: acc } = await query('SELECT id, email, name, role FROM accounts WHERE id = $1', [used.rows[0].account_id]);
  const session = await createSession(acc[0].id);
  setSessionCookie(res, session);
  res.json({ account: publicAccount(acc[0]) });
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
