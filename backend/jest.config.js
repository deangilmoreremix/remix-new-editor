/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'mjs', 'json'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],
  transform: {},
};
