import * as ChildProcess from "child_process";

import runChecksync from "../run-checksync";

jest.mock("child_process");

describe("#runChecksync", () => {
    const launcher = {command: "node", args: ["checksync.js"]};

    it("should run the launcher with the checksync args after its own", () => {
        // Arrange
        const spawnSyncSpy = jest
            .spyOn(ChildProcess, "spawnSync")
            .mockReturnValue({
                status: 0,
                stdout: "",
                stderr: "",
            } as any);

        // Act
        runChecksync(launcher, ["--json"], "/repo");

        // Assert
        expect(spawnSyncSpy).toHaveBeenCalledWith(
            "node",
            ["checksync.js", "--json"],
            expect.objectContaining({cwd: "/repo"}),
        );
    });

    it("should disable color so the output is plain text", () => {
        // Arrange
        const spawnSyncSpy = jest
            .spyOn(ChildProcess, "spawnSync")
            .mockReturnValue({
                status: 0,
                stdout: "",
                stderr: "",
            } as any);

        // Act
        runChecksync(launcher, [], "/repo");

        // Assert
        expect(spawnSyncSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                env: expect.objectContaining({FORCE_COLOR: "0"}),
            }),
        );
    });

    it("should return the exit code and output of the run", () => {
        // Arrange
        jest.spyOn(ChildProcess, "spawnSync").mockReturnValue({
            status: 3,
            stdout: "out",
            stderr: "err",
        } as any);

        // Act
        const result = runChecksync(launcher, [], "/repo");

        // Assert
        expect(result).toEqual({exitCode: 3, stdout: "out", stderr: "err"});
    });

    it("should throw if the process could not be started", () => {
        // Arrange
        jest.spyOn(ChildProcess, "spawnSync").mockReturnValue({
            error: new Error("ENOENT"),
        } as any);

        // Act
        const act = () => runChecksync(launcher, [], "/repo");

        // Assert
        expect(act).toThrow("ENOENT");
    });

    it("should throw if the process was killed since there is no exit code to record", () => {
        // Arrange
        jest.spyOn(ChildProcess, "spawnSync").mockReturnValue({
            status: null,
            signal: "SIGKILL",
        } as any);

        // Act
        const act = () => runChecksync(launcher, [], "/repo");

        // Assert
        expect(act).toThrow("checksync was terminated by signal SIGKILL");
    });
});
