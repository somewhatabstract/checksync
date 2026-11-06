/**
 * A single checksync invocation recorded by the conformance oracle.
 */
export type ConformanceCase = {
    /**
     * Unique identifier for the case, which is also the path of its golden
     * files, without extension, relative to the directory that holds all the
     * goldens.
     */
    id: string;

    /**
     * The arguments passed to checksync.
     */
    args: ReadonlyArray<string>;

    /**
     * The path, relative to the repository root, of the marker cache file the
     * case writes, if it writes one.
     */
    cacheFile?: string;

    /**
     * The example to copy into a scratch root and run the case there, if the
     * case writes files.
     *
     * The files the run changes are recorded too.
     */
    scratchExample?: string;
};

/**
 * One entry in a snapshot of a directory tree.
 *
 * Symbolic links are recorded as links, not followed, so that writing through
 * a link can be told apart from replacing it.
 */
export type FileEntry =
    {kind: "file"; content: Buffer} | {kind: "symlink"; target: string};

/**
 * The entries of a directory tree, keyed by forward-slash path relative to
 * the snapshotted directory.
 */
export type FileSnapshot = ReadonlyMap<string, FileEntry>;

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
