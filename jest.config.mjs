/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
        '^.+\\.(sh|ps1|svg)$': '<rootDir>/tests/jest-text-loader.js',
    },
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.ts'],
    testMatch: ['<rootDir>/tests/**/*.test.ts'],
    testTimeout: 40000,
    coverageReporters: ['json'],
    coverageDirectory: 'coverage/app',
    bail: true,
};
