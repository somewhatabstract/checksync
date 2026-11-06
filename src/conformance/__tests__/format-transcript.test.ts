import formatTranscript from "../format-transcript";

describe("#formatTranscript", () => {
    const testCase = {id: "example.json", args: ["--json", "a/**"]};

    it("should include the args, exit code, stdout, and stderr", () => {
        // Arrange
        const result = {exitCode: 3, stdout: "out\n", stderr: "err\n"};

        // Act
        const transcript = formatTranscript(testCase, result);

        // Assert
        expect(transcript).toBe(
            `args: ["--json","a/**"]\n` +
                "exit code: 3\n" +
                "--- stdout ---\nout\n" +
                "--- stderr ---\nerr\n",
        );
    });

    it("should leave an empty stream empty", () => {
        // Arrange
        const result = {exitCode: 0, stdout: "", stderr: ""};

        // Act
        const transcript = formatTranscript(testCase, result);

        // Assert
        expect(transcript).toBe(
            `args: ["--json","a/**"]\n` +
                "exit code: 0\n" +
                "--- stdout ---\n" +
                "--- stderr ---\n",
        );
    });

    it("should note a missing final newline so it isn't lost from the transcript", () => {
        // Arrange
        const result = {exitCode: 0, stdout: "out", stderr: ""};

        // Act
        const transcript = formatTranscript(testCase, result);

        // Assert
        expect(transcript).toContain(
            "--- stdout ---\nout\n\\ No newline at end of stdout\n",
        );
    });

    it("should include the working directory when the case sets one", () => {
        // Arrange
        const caseWithCwd = {...testCase, cwd: "fixtures/a"};
        const result = {exitCode: 0, stdout: "", stderr: ""};

        // Act
        const transcript = formatTranscript(caseWithCwd, result);

        // Assert
        expect(transcript).toBe(
            `args: ["--json","a/**"]\n` +
                "cwd: fixtures/a\n" +
                "exit code: 0\n" +
                "--- stdout ---\n" +
                "--- stderr ---\n",
        );
    });

    it("should record only that stderr had output when the case asks for that", () => {
        // Arrange
        const caseWithPresence = {...testCase, stderrPresenceOnly: true};
        const result = {exitCode: 6, stdout: "", stderr: "at x (main.js:1:2)"};

        // Act
        const transcript = formatTranscript(caseWithPresence, result);

        // Assert
        expect(transcript).toContain(
            "--- stderr ---\n(not recorded, but not empty)\n",
        );
    });

    it("should leave empty stderr empty when recording only its presence", () => {
        // Arrange
        const caseWithPresence = {...testCase, stderrPresenceOnly: true};
        const result = {exitCode: 6, stdout: "", stderr: ""};

        // Act
        const transcript = formatTranscript(caseWithPresence, result);

        // Assert
        expect(transcript).toEndWith("--- stderr ---\n");
    });
});
