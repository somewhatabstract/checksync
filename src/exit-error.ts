import {ExitCode} from "./exit-codes";

/**
 * Error thrown to communicate an process exit condition.
 */
export class ExitError extends Error {
    constructor(message: string, exitCode: ExitCode, options?: ErrorOptions) {
        super(message, options);
        this.name = "ExitError";
        this.exitCode = exitCode;
    }

    readonly exitCode: ExitCode;

    toString(): string {
        return `${this.name}: ${this.message} (Exit code: ${this.exitCode})`;
    }
}
