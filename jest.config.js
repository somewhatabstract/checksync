// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    // Automatically restore mocks between every test
    resetMocks: true,
    restoreMocks: true,

    // The directory where Jest should output its coverage files
    coverageDirectory: "coverage",

    // Where our coverage data does and does not come from.
    collectCoverageFrom: ["src/**/*.js", "!src/__tests__/*.js"],

    // The test environment that will be used for testing
    testEnvironment: "node",

    // Setting this value to "fake" allows the use of fake timers for functions such as "setTimeout"
    fakeTimers: {
        enableGlobally: true,
    },

    setupFilesAfterEnv: ["jest-extended/all", "./jest.setup.js"],
};
