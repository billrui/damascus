import { env } from '../config/env.js';

/**
 * Global error handler — must be registered LAST in Express.
 * Usage: app.use(errorHandler)
 */
export function errorHandler(err, req, res, next) {
  // Operational errors with an explicit status (thrown by our code)
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Don't leak stack traces in production
  const response = {
    error:   status >= 500 ? 'Internal server error' : message,
    message: status >= 500 && env.NODE_ENV === 'production' ? undefined : message,
  };

  if (env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);
  }

  res.status(status).json(response);
}

/**
 * notFound — catch-all for unmatched routes
 */
export function notFound(req, res) {
  res.status(404).json({
    error:   'Not found',
    message: `${req.method} ${req.path} does not exist`,
  });
}
