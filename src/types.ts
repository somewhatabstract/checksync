import {ErrorCode} from "./error-codes";

export const NoChecksum = "No checksum";

export interface IStandardLog {
    readonly group: (...labels: ReadonlyArray<string>) => void;
    readonly groupEnd: () => void;
    readonly error: (message: string) => void;
    readonly info: (message: string) => void;
    readonly log: (message: string) => void;
    readonly warn: (message: string) => void;
}

export interface ILog extends IStandardLog {
    readonly verbose: (arg1: () => string | null | undefined) => void;
}

export interface IPositionLog extends ILog {
    readonly error: (message: string, line?: string | number) => void;
    readonly info: (message: string, line?: string | number) => void;
    readonly log: (message: string, line?: string | number) => void;
    readonly warn: (message: string, line?: string | number) => void;
    readonly mismatch: (message: string, line?: string | number) => void;
    readonly migrate: (message: string, line?: string | number) => void;
    readonly fix: (message: string, line?: string | number) => void;
}

export type FixAction =
    | {
          type: "delete";
          line: number;
          description: string;
          // The original declaration being deleted.
          declaration: string;
      }
    | {
          type: "replace";
          line: number;
          text: string;
          description: string;
          // The original declaration being replaced.
          declaration: string;
      };

export type ErrorDetails = {
    /**
     * The id of the marker that the error is associated with.
     *
     * This is null when an error cannot be associated to a specific marker.
     */
    markerID: string | null;
    /**
     * The text we would log to the user about this.
     */
    reason: string;
    /**
     * The type of error. This is an enumeration of strings
     * giving semantic meaning to the error.
     */
    code: ErrorCode;
    /**
     * This is the specific range of the error.
     * Useful for highlighting the specific issue.
     */
    location?: {
        line: number;
        startColumn?: number;
        endColumn?: number;
    };
    /**
     * This describes how to fix the issue.
     */
    fix?: FixAction;
};

export type TargetType = "local" | "remote";

/**
 * A marker target.
 */
export type Target = {
    /**
     * The target file path or URL that a marker references.
     */
    readonly target: string;
    /**
     * The type of the target.
     *
     * Local targets are files we can parse for the return markers.
     * Remote targets are URLs.
     */
    readonly type: TargetType;
    /**
     * The checksum that a marker has recorded for the target marker.
     *
     * For local targets, the mismatch between this and the target marker's
     * actual checksum is what we will pick up and report/fix.
     *
     * For remote targets, the mismatch between this and the marker's
     * self-checksum is what we will pick up and report/fix.
     */
    readonly checksum: string;
    /**
     * The full line of text declaring the sync-start for this target.
     */
    readonly declaration: string;
};

/**
 * Target declarations by the line on which the declaration exists.
 * This is the line that will need to be updated if the target checksum
 * is incorrect.
 */
export type Targets = {
    [line: number]: Target;
};

/**
 * The result of parsing a file.
 */
export type FileParseResult = {
    /**
     * The file is read-only, or not.
     */
    readonly readOnly: boolean;
    /**
     * The markers found in the file, if any.
     */
    readonly markers: Markers | null | undefined;
    /**
     * The files referenced by this file.
     */
    readonly referencedFiles: ReadonlyArray<string>;
    /**
     * Error details for the file parse result, or null if there was no error.
     */
    readonly errors: ReadonlyArray<ErrorDetails>;
    /**
     * How many lines we found in this file.
     */
    readonly lineCount?: number;
};

/**
 * A marker.
 *
 * This represents a marker with a given ID and chunk of content.
 * It points to other markers in other locations that it is synced with.
 * Each of those other markers is a target - file, line number, and checksum
 * of its content.
 */
export type Marker = {
    /**
     * The actual checksum value of the marker content.
     */
    readonly contentChecksum: string;
    /**
     * The actual checksum value of the marker content and the relative path
     * of the file containing the marker.
     */
    readonly selfChecksum: string;
    /**
     * The targets that the marker syncs with.
     */
    readonly targets: Targets;
    /**
     * The comment start detected for the marker.
     */
    readonly commentStart: string;
    /**
     * The comment end detected for the marker.
     */
    readonly commentEnd: string | null | undefined;
};

/**
 * A map of markers.
 */
export type Markers = {
    /**
     * Marker id to the marker details.
     */
    [id: string]: Marker;
};

export type FileInfo = {
    readonly readOnly: boolean;
    readonly aliases: Array<string>;
    readonly markers: Markers;
    readonly errors: ReadonlyArray<ErrorDetails>;
    readonly lineCount?: number;
};

/**
 * All the markers we're working with as a map from filepath to its markers.
 */
export type MarkerCache = {
    /**
     * A file path mapped to the markers within it.
     */
    [file: string]: FileInfo;
};

export type normalizeTargetFn = (
    relativeFile: string,
) => Readonly<NormalizedPathInfo>;

export type MigrationOptions = {
    mode: "all" | "missing";
    mappings: Record<string, string>;
};

export type Options = {
    /**
     * The paths and globs for identifying files that are to be processed.
     */
    includeGlobs: ReadonlyArray<string>;
    /**
     * Include paths that begin with a dot, e.g. ".gitignore" when parsing
     * `includeGlobs`.
     */
    includeDotPaths: boolean;
    /**
     * The globs for files that are to be ignored.
     */
    excludeGlobs: ReadonlyArray<string>;
    /**
     * .gitignore-syntax files indicating files that are to be ignored.
     *
     * Absolute and relative paths (i.e. "/user/.gitignore" or "./.gitignore")
     * are treated as exact matches to a single file.
     *
     * Glob patterns are also supported.
     */
    ignoreFiles: ReadonlyArray<string>;
    /**
     * When true, any fixable violations should be fixed automatically.
     */
    autoFix: boolean;
    /**
     * When true, the details of the processing are returned to stdout as a
     * JSON format string.
     */
    json: boolean;
    /**
     * The comment styles to be supported.
     */
    comments: ReadonlyArray<string>;
    /**
     * When true, destructive actions such as auto-fixes are not actually
     * written.
     */
    dryRun: boolean;
    /**
     * The name of the marker file that identifies the root of sync-tag paths.
     */
    rootMarker?: string | null | undefined;
    /**
     * When false, a tag must contain content to be considered valid;
     * when true, a tag may be empty.
     */
    allowEmptyTags?: boolean;
    /**
     * The path to the cache file.
     *
     * This is only used if cacheMode is not "ignore".
     */
    cachePath: string;
    /**
     * The cache mode.
     *
     * When "write", all files are parsed and the cache is written to the
     * given file.
     *
     * When "read", instead of parsing files, the cache file is read and used
     * to produce the desired output.
     */
    cacheMode: "ignore" | "write" | "read";
    /**
     * Migration configuration.
     *
     * Targets that begin with a given prefix in mappings will be replaced
     * with the corresponding value.
     *
     * When mode is "all", all targets that match a mapping will be updated
     * with the corresponding prefix; when mode is "missing", only local
     * targets that cannot be found will be updated.
     */
    migration?: MigrationOptions;
};

export type NormalizedPathInfo = {
    path: string;
    exists: boolean;
    type: TargetType;
};

export type ErrorDetailsByDeclaration = {
    [key: string]: Array<ErrorDetails>;
};
