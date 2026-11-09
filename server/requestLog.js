// S3-11: one JSON line per API request. It records no query strings, bodies, cookies, emails or
// tokens: only method, path, status, timing, error code and the numeric account id.
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

export function requestLog(req, res, next) {
  const id = randomUUID();
  res.setHeader('X-Request-Id', id);
  if (!config.logRequests || req.path === '/health') return next();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const entry = {
      t: new Date().toISOString(),
      id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Number((process.hrtime.bigint() - started) / 1000n) / 1000,
      account: req.account?.id ?? null,
      role: req.account?.role ?? null,
    };
    if (res.locals.errorCode) entry.error = res.locals.errorCode;
    console.log(JSON.stringify(entry));
  });
  next();
}
