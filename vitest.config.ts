import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Cryptographic TEST CONFIGURATION  Vitest
 *
 * Covers:
 *   - Unit tests: lib/crypto, lib/audit, lib/resilience, lib/security
 *   - Integration tests: API routes (with Prisma mocks)
 *   - Property-based tests: fast-check (run via separate script)
 *
 * Coverage target: >92% on critical paths (middleware, crypto, audit, resilience)
 *
 * Run:
 *   npx vitest run                     all tests once
 *   npx vitest run --coverage          with coverage report
 *   npx vitest watch                   watch mode
 *   npx vitest run test/unit/crypto    specific suite
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    retry: 2,
    include: [
      'test/**/*.test.ts',
      'test/**/*.spec.ts',
    ],
    exclude: [
      'node_modules',
      '.next',
      'test/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'middleware.ts',
        'lib/crypto/**',
        'lib/audit/**',
        'lib/resilience/**',
        'lib/security/**',
        'services/analytics/**',
      ],
      thresholds: {
        // Sovereign grade: >92% on critical paths
        statements: 92,
        branches: 88,
        functions: 92,
        lines: 92,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'test/mocks/empty.js'),
    },
  },
});
