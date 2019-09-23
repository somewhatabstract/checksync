// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    // Automatically restore mocks between every test
    resetMocks: true,
    restoreMocks: true,

    // The directory where Jest should output its coverage files
    coverageDirectory: "coverage",

    // The test environment that will be used for testing
    testEnvironment: "node",

    testPathIgnorePatterns: process.env.ALLOW_INTEGRATION_TESTS
        ? []
        : ["integration"],

    // Setting this value to "fake" allows the use of fake timers for functions such as "setTimeout"
    timers: "fake",

    setupFilesAfterEnv: ["jest-extended", "./jest.setup.js"],
};
