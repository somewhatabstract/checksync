import exit from "../exit";
import {ExitCode} from "../exit-codes";

describe("exit", () => {
    it("should verbose log the exit code and name", () => {
        // Arrange
        const log = {
            verbose: jest.fn(),
        } as any;
        // @ts-expect-error process.exit is typed as never, but we don't want
        // that here
        jest.spyOn(process, "exit").mockImplementationOnce(() => {});
        exit(log, ExitCode.SUCCESS);
        const verboseLogFn = log.verbose.mock.calls[0][0];

        // Act
        const result = verboseLogFn();

        // Assert
        expect(result).toBe("Exiting with code 0: SUCCESS");
    });

    it("should exit the process with the given code", () => {
        // Arrange
        const log = {
            verbose: jest.fn(),
        } as any;
        const exitSpy = jest
            .spyOn(process, "exit")
            // @ts-expect-error process.exit is typed as never, but we don't
            // want that here
            .mockImplementationOnce(() => {});

        // Act
        exit(log, ExitCode.SUCCESS);

        // Assert
        expect(exitSpy).toHaveBeenCalledWith(ExitCode.SUCCESS);
    });
});
