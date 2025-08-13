const path = require('path');

module.exports = {
  testEnvironment: 'node',

  /* Tell Jest how to transpile every *.js file (src *and* node_modules) */
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  /* Do NOT ignore ESM-only vendor libraries */
  transformIgnorePatterns: [
    'node_modules/(?!(openai|@google|@anthropic-ai|@modelcontextprotocol)/)'
  ],

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'          // allow bare ".js" in imports
  },

  testMatch: ['**/tests/**/*.test.js'],

  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],

  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 }
  },

  testTimeout: 30000,
  verbose: true
};
