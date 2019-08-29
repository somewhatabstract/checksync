// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    // Automatically reset mocks between every test
    resetMocks: true,

    // The directory where Jest should output its coverage files
    coverageDirectory: "coverage",

    // The test environment that will be used for testing
    testEnvironment: "node",

    // Setting this value to "fake" allows the use of fake timers for functions such as "setTimeout"
    timers: "fake",
};
