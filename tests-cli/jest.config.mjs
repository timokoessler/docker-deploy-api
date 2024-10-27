/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
        '^.+\\.(sh|ps1|svg)$': '<rootDir>/../tests/jest-text-loader.js',
    },
    testMatch: ['<rootDir>/../tests-cli/**/*.test.ts'],
    collectCoverage: true,
    coverageReporters: ['none'],
    testTimeout: 30_000,
    maxConcurrency: 0,
};
