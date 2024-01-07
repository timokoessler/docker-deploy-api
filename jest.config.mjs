/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
        '^.+\\.(sh|ps1|svg)$': '<rootDir>/tests/jest-text-loader.js',
    },
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.ts'],
    testTimeout: 20000,
    coverageDirectory: 'coverage',
};
