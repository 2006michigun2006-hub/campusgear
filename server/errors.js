export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = () => new HttpError(401, 'UNAUTHENTICATED', 'Please sign in first.');
export const forbidden = () => new HttpError(403, 'FORBIDDEN', 'You do not have access to this action.');
export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (code, message, details) => new HttpError(409, code, message, details);

export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    res.locals.errorCode = err.code;
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  }
  console.error(err);
  res.locals.errorCode = 'INTERNAL';
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } });
}
