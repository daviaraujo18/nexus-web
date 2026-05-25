/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/firebase/config$': '<rootDir>/tests/__mocks__/firebase-config.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
};
