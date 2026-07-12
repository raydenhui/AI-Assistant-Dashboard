module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  // Map .js imports to their source files (needed for NodeNext module resolution)
  moduleNameMapper: {
    '^(\\.\\.\\.?/.*)\\.js$': '$1',
    '^(\\.\\.?/.*)\\.js$': '$1',
  },
};
