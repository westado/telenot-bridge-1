export default {
    testEnvironment: 'node',
    transform: {},
    moduleFileExtensions: ['js', 'mjs'],
    testMatch: ['**/__tests__/**/*.mjs', '**/?(*.)+(spec|test).mjs'],
    verbose: true,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    fakeTimers: {
        enableGlobally: true,
        legacyFakeTimers: false,
    },
}
