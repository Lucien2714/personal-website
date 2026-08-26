import {z} from 'zod';

/**
 * Runtime configuration, validated once at module load.
 *
 * Reading `process.env` directly scatters implicit contracts across the code
 * base: every call site has to decide what to do about a missing or malformed
 * value, and a typo only shows up as `undefined` deep inside a request. This
 * module turns the environment into a single typed object and fails fast, at
 * boot, with a message that names every offending variable at once.
 */

/** Parses a positive integer from a string, falling back to a default. */
const positiveIntWithDefault = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? fallback : Number(value)))
    .pipe(z.number().int().positive());

const serverSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) =>
        value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must be a PostgreSQL connection string',
    ),

  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    // A trailing slash would produce URLs such as `https://site.com//posts`.
    .transform((value) => value.replace(/\/$/, '')),

  AUTH_SECRET: z
    .string()
    .min(
      32,
      'AUTH_SECRET must be at least 32 characters; generate one with `openssl rand -base64 48`',
    ),

  AUTH_SESSION_TTL_SECONDS: positiveIntWithDefault(60 * 60 * 24 * 7),

  UPLOAD_DIR: z.string().default('./public/uploads'),
  UPLOAD_MAX_BYTES: positiveIntWithDefault(10 * 1024 * 1024),

  API_CORS_ORIGINS: z.string().default('*'),
  API_RATE_LIMIT_PER_MINUTE: positiveIntWithDefault(120),
});

/** Shape of the validated server environment. */
export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Validates `process.env` and returns the typed result.
 *
 * @throws {Error} If any variable is missing or malformed. The message lists
 *     every problem so that a misconfigured deployment can be fixed in one
 *     pass rather than one variable per restart.
 */
function parseServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return parsed.data;
}

/** The validated server environment. Import this instead of `process.env`. */
export const env: ServerEnv = parseServerEnv();

/** True when running the production build. */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Origins permitted to call the public API from a browser.
 *
 * `['*']` means "any origin", which is safe for the read-only endpoints
 * because they never depend on cookies.
 */
export const apiCorsOrigins: string[] = env.API_CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
