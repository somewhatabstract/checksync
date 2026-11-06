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

    it("should keep only the first line of stderr when the case asks for that", () => {
        // Arrange
        const caseWithFirstLine = {...testCase, stderrFirstLineOnly: true};
        const result = {
            exitCode: 6,
            stdout: "",
            stderr: "Error    a.json\nat x (main.js:1:2)\n",
        };

        // Act
        const transcript = formatTranscript(caseWithFirstLine, result);

        // Assert
        expect(transcript).toEndWith(
            "--- stderr ---\nError    a.json\n(rest not recorded)\n",
        );
    });

    it("should keep stderr whole when it is only one line", () => {
        // Arrange
        const caseWithFirstLine = {...testCase, stderrFirstLineOnly: true};
        const result = {exitCode: 6, stdout: "", stderr: "Error    a.json\n"};

        // Act
        const transcript = formatTranscript(caseWithFirstLine, result);

        // Assert
        expect(transcript).toEndWith("--- stderr ---\nError    a.json\n");
    });

    it("should keep a single line without a newline as it is", () => {
        // Arrange
        const caseWithFirstLine = {...testCase, stderrFirstLineOnly: true};
        const result = {exitCode: 6, stdout: "", stderr: "Error"};

        // Act
        const transcript = formatTranscript(caseWithFirstLine, result);

        // Assert
        expect(transcript).toEndWith(
            "--- stderr ---\nError\n\\ No newline at end of stderr\n",
        );
    });
});
