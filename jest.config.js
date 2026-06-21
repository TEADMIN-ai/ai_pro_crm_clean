/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  roots: ["<rootDir>/src"],

  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx"
  ],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^server-only$": "<rootDir>/src/__tests__/serverOnlyMock.ts"
  },

  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },

  workerThreads: true,

  collectCoverage: false,

  verbose: true
};
