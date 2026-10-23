/**
 * A single checksync invocation recorded by the conformance oracle.
 */
export type ConformanceCase = {
    /**
     * Unique identifier for the case, used to name its golden file.
     */
    id: string;

    /**
     * The arguments passed to checksync.
     */
    args: ReadonlyArray<string>;
};

/**
 * The observable result of running checksync.
 */
export type RunResult = {
    exitCode: number;
    stdout: string;
    stderr: string;
};

/**
 * The command used to launch checksync.
 */
export type Launcher = {
    /**
     * The executable to run.
     */
    command: string;

    /**
     * Arguments that come before the checksync arguments, such as the
     * script path when the executable is `node`.
     */
    args: ReadonlyArray<string>;
};

/**
 * Values that vary by machine or release and are replaced in recorded output.
 */
export type NormalizeOptions = {
    /**
     * The absolute path of the repository root.
     */
    rootDir: string;

    /**
     * The launch string checksync reports for itself, which is replaced
     * with `checksync`.
     */
    launchString: string;

    /**
     * The platform's path separator. When it is a backslash, backslashes in
     * the output are treated as path separators.
     */
    pathSeparator: string;
};

/**
 * The outcome of checking a transcript against its golden file.
 */
export type GoldenOutcome = "match" | "mismatch" | "missing" | "updated";
