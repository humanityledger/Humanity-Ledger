import { defineConfig } from '@prisma/config';
import { config as loadEnv } from 'dotenv';

/**
 * Prisma 6 stopped loading .env files automatically once a prisma.config.ts
 * exists — the CLI prints "Prisma config detected, skipping environment
 * variable loading" and then fails with P1012 because DATABASE_URL is unset.
 *
 * Loading them here restores the behaviour everyone expects. Order matters:
 * .env.local wins over .env, matching Next.js, so a developer's local
 * override is not silently replaced by the committed defaults.
 *
 * `override: false` means the first file to define a key keeps it, and a
 * variable already present in the real environment (CI, Railway, a shell
 * export) beats both files.
 */
loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

export default defineConfig({});
