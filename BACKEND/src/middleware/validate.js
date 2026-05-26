import { z } from 'zod';

/**
 * validate(schema)
 * Returns a middleware that validates req.body against a Zod schema.
 * On failure it returns 422 with field-level error messages.
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), handler)
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => ({
        field:   i.path.join('.'),
        message: i.message,
      }));
      return res.status(422).json({
        error:  'Validation failed',
        errors,
      });
    }
    req.body = result.data;   // replace with coerced/defaulted values
    next();
  };
}

/**
 * validateQuery(schema)
 * Same but for req.query (GET parameters).
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map(i => ({
        field:   i.path.join('.'),
        message: i.message,
      }));
      return res.status(422).json({ error: 'Invalid query parameters', errors });
    }
    req.query = result.data;
    next();
  };
}

// ─── Reusable schemas ─────────────────────────────────────────────────────────

export const loginSchema = z.object({
  user_id:   z.coerce.number().int().positive(),
  pin:       z.string().min(4).max(8),
  device_id: z.string().max(100).optional(),
});

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const dateRangeSchema = z.object({
  from:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).merge(paginationSchema);
