import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { loadSession } from './auth.js';
import { mailEnabled } from './mail.js';
import { config } from './config.js';
import { query } from './db.js';
import { errorHandler } from './errors.js';
import { requestLog } from './requestLog.js';
import assetsRouter from './routes/assets.js';
import authRouter from './routes/auth.js';
import reservationsRouter from './routes/reservations.js';
import staffRouter from './routes/staff.js';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render terminates TLS in front of the app
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(requestLog);

  // CSRF defence: state-changing calls must be JSON, which a cross-site form cannot send.
  api.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: { code: 'JSON_REQUIRED', message: 'Send requests as application/json.' } });
    }
    next();
  });

  api.get('/health', async (_req, res) => {
    await query('SELECT 1');
    res.json({ ok: true });
  });
  api.use(loadSession);
  api.get('/config', (_req, res) => res.json({ rules: config.rules, emailSignIn: mailEnabled() }));
  api.use('/auth', authRouter);
  api.use('/assets', assetsRouter);
  api.use('/reservations', reservationsRouter);
  api.use('/staff', staffRouter);
  api.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }));
  api.use(errorHandler);
  app.use('/api', api);

  if (existsSync(distDir)) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }
  return app;
}
