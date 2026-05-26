import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const schema = z.object({
  NODE_ENV:            z.enum(['development', 'production', 'test']).default('development'),
  PORT:                z.coerce.number().default(3001),
  DATABASE_URL:        z.string().url(),
  DB_POOL_MIN:         z.coerce.number().default(2),
  DB_POOL_MAX:         z.coerce.number().default(10),
  REDIS_URL:           z.string().default('redis://localhost:6379'),
  JWT_SECRET:          z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),
  CLIENT_ORIGIN:       z.string().default('http://localhost:5173'),
  BUSINESS_NAME:       z.string().default('Damascus Hotel'),
  BUSINESS_ADDRESS:    z.string().default('Kericho, Kenya'),
  BUSINESS_TEL:        z.string().default(''),
  BUSINESS_VAT:        z.string().default(''),
  RECEIPT_STORAGE_PATH:z.string().default('./storage/receipts'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  parsed.error.issues.forEach(i => console.error(`   ${i.path.join('.')}: ${i.message}`));
  process.exit(1);
}

export const env = parsed.data;
