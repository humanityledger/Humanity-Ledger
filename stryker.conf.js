// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [
    'lib/security/**/*.ts',
    'lib/session.ts',
    'lib/jwt.ts',
    '!lib/**/*.d.ts',
    '!lib/**/*.test.ts',
  ],
  thresholds: {
    high: 85,
    low: 70,
    break: 70,
  },
};
