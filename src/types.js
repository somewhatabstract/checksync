// @flow
import type {ErrorCode} from "./error-codes.js";

export const NoChecksum = "No checksum";

export interface IStandardLog {
    +group: (...labels: Array<string>) => void;
    +groupEnd: () => void;

    +error: (message: string) => void;
    +info: (message: string) => void;
    +log: (message: string) => void;
    +warn: (message: string) => void;
}

export interface ILog extends IStandardLog {
    +verbose: (() => string) => void;
}

export interface IPositionLog extends ILog {
    +error: (message: string, line?: string | number) => void;
    +info: (message: string, line?: string | number) => void;
    +log: (message: string, line?: string | number) => void;
    +warn: (message: string, line?: string | number) => void;
    +mismatch: (message: string, line?: string | number) => void;
    +fix: (message: string, line?: string | number) => void;
}

export type FixAction =
    | {
          type: "delete",
          line: number,
          description: string,
          // The original declaration being deleted.
          declaration: string,
      }
    | {
          type: "replace",
          line: number,
          text: string,
          description: string,
          // The original declaration being replaced.
          declaration: string,
      };

export type ErrorDetails = {
    // The text we would log to the user about this.
    reason: string,
    // The type of error. This is an enumeration of strings
    // giving semantic meaning to the error.
    code: ErrorCode,
    // This is the specific range of the error.
    // Useful for highlighting the specific issue.
    location?: {line: number, startColumn?: number, endColumn?: number},
    // This describes how to fix the issue.
    fix?: FixAction,
};

/**
 * A marker target.
 */
export type Target = {
    /**
     * The file that a marker references.
     */
    +file: string,

    /**
     * The checksum that a marker has recorded for the target marker.
     * The mismatch between this and the target marker's actual checksum is
     * what we will pick up and report/fix.
     */
    +checksum: string,

    /**
     * The full line of text declaring the sync-start for this target.
     */
    +declaration: string,
};

/**
 * Target declarations by the line on which the declaration exists.
 * This is the line that will need to be updated if the target checksum
 * is incorrect.
 */
export type Targets = {
    [line: number]: Target,
    ...
};

/**
 * The result of parsing a file.
 */
export type FileParseResult = {
    /**
     * The file is read-only, or not.
     */
    +readOnly: boolean,
    /**
     * The markers found in the file, if any.
     */
    +markers: ?Markers,

    /**
     * The files referenced by this file.
     */
    +referencedFiles: Array<string>,

    /**
     * Error details for the file parse result, or null if there was no error.
     */
    +errors: Array<ErrorDetails>,

    /**
     * How many lines we found in this file.
     */
    +lineCount?: number,
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
    +checksum: string,

    /**
     * The targets that the marker syncs with.
     */
    +targets: Targets,

    /**
     * The comment start detected for the marker.
     */
    +commentStart: string,

    /**
     * The comment end detected for the marker.
     */
    +commentEnd: ?string,
};

/**
 * A map of markers.
 */
export type Markers = {
    /**
     * Marker id to the marker details.
     */
    [id: string]: Marker,
    ...
};

export type FileInfo = {
    +readOnly: boolean,
    +aliases: Array<string>,
    +markers: Markers,
    +errors: Array<ErrorDetails>,
    +lineCount?: number,
};

/**
 * All the markers we're working with as a map from filepath to its markers.
 */
export type MarkerCache = {
    /**
     * A file path mapped to the markers within it.
     */
    [file: string]: FileInfo,
    ...
};

export type normalizePathFn = (relativeFile: string) => {
    file: string,
    exists: boolean,
};

export type Options = {
    /**
     * The paths and globs for identifying files that are to be processed.
     */
    includeGlobs: Array<string>,

    /**
     * The globs for files that are to be ignored.
     */
    excludeGlobs: Array<string>,

    /**
     * .gitignore-syntax files indicating files that are to be ignored.
     *
     * Absolute and relative paths (i.e. "/user/.gitignore" or "./.gitignore")
     * are treated as exact matches to a single file.
     *
     * File names like ".gitignore" are interpreted as being files to use in
     * each folder processed.
     *
     * TODO: Support that second scenario (see #636)
     */
    ignoreFiles: Array<string>,

    /**
     * When true, any fixable violations should be fixed automatically.
     */
    autoFix: boolean,

    /**
     * When true, the details of the processing are returned to stdout as a
     * JSON format string.
     */
    json: boolean,

    /**
     * The comment styles to be supported.
     */
    comments: Array<string>,

    /**
     * When true, destructive actions such as auto-fixes are not actually
     * written.
     */
    dryRun: boolean,

    /**
     * The name of the marker file that identifies the root of sync-tag paths.
     */
    rootMarker?: ?string,
};

export type NormalizedFileInfo = {
    file: string,
    exists: boolean,
};
