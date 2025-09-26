module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/v2', '<rootDir>/tests/v2'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/v2/**/*.ts',
    '!src/v2/**/*.d.ts',
    '!src/v2/**/index.ts',
    '!src/v2/server.ts',
  ],
  coverageDirectory: 'coverage/v2',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/v2/$1',
  },
  testTimeout: 10000,
};