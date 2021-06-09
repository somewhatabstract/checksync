// @flow
import type {ErrorCode} from "./error-codes.js";

// const exampleMarkersA = {
//     filea: {
//         markerA: {
//             fixable: true,
//             checksum: "345678", // The actual checksum
//             targets: [
//                 { line: 10, file: "fileb", checksum: "2345678" /* What this file thinks this checksum should be for this marker */  },
//                 { line: 104, file: "filec", checksum: "2345678" },
//             ],
//         },
//     },
// };
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
    +errorsLogged: boolean;
    +verbose: (() => string) => void;
}

export interface IPositionLog extends ILog {
    +error: (message: string, line?: string | number) => void;
    +info: (message: string, line?: string | number) => void;
    +log: (message: string, line?: string | number) => void;
    +warn: (message: string, line?: string | number) => void;
    +mismatch: (message: string, line?: string | number) => void;
}

export const FileError = Object.freeze({
    couldNotParse: "could-not-parse",
});

export const MarkerError = Object.freeze({
    duplicate: "duplicate-marker",
    empty: "empty",
    endTagWithoutStartTag: "end-tag-without-start-tag",
    malformedEndTag: "malformed-end-tag",
    selfTargeting: "self-targeting",
    startTagWithoutEndTag: "start-tag-witout-end-tag",
});

export const TargetError = Object.freeze({
    malformedStartTag: "malformed-start-tag",
    differentCommentSyntax: "different-comment-syntax",
    fileDoesNotExist: "file-does-not-exist",
    duplicate: "duplicate-target",
    startTagAfterContent: "start-tag-after-content",
    noReturnTag: "no-return-tag",
});

type FileErrorDetails = {
    message: string,
    code: $Values<typeof FileError>,
};

type LineErrorDetails<TCodes: string> = {
    message: string,
    code: TCodes,
    line: number,
};

export type TargetErrorDetails = LineErrorDetails<$Values<typeof TargetError>>;
export type MarkerErrorDetails = LineErrorDetails<$Values<typeof MarkerError>>;

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

    /**
     * The error detail for this target, or null if there is no error.
     */
    +error: ?TargetErrorDetails,
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
     * The markers found in the file, if any.
     */
    markers: ?Markers,

    /**
     * The files referenced by this file.
     */
    referencedFiles: Array<string>,

    /**
     * Error details for the file parse result, or null if there was no error.
     */
    error: ?FileErrorDetails,
};

/**
 * A marker.
 */
export type Marker = {
    /**
     * The error details for this marker.
     */
    +errors: $ReadOnlyArray<MarkerErrorDetails>,

    /**
     * Indicates if this marker's checksum can be updated during fixing.
     */
    +fixable: boolean,

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

export type EdgeErrorDetails = TargetErrorDetails | MarkerErrorDetails;

export type MarkerEdge = {
    /**
     * The errors for this marker edge.
     */
    +errors: $ReadOnlyArray<EdgeErrorDetails>,

    /**
     * The marker identifier.
     */
    +markerID: string,

    /**
     * The line number in the source file where the marker is declared.
     */
    +sourceLine: number,

    /**
     * The checksum that the source file has recorded for the target content.
     */
    +sourceChecksum: string,

    /**
     * The full tag declaration of the marker target in the source file.
     */
    +sourceDeclaration: string,

    /**
     * The start of the tag comment that the source file uses.
     */
    +sourceCommentStart: string,

    /**
     * The end of the tag comment that the source file uses.
     */
    +sourceCommentEnd: ?string,

    /**
     * The tag path to the target file of the marker.
     *
     * This is normalized to use the / character as a path separator,
     * regardless of OS.
     */
    +targetFile: string,

    /**
     * The line number in the target file where the marker begins.
     * Null if the target file doesn't exist or doesn't have a return reference.
     */
    +targetLine: ?string,

    /**
     * The actual checksum of the target content.
     * Null if the target file doesn't exist or doesn't have a return reference.
     */
    +targetChecksum: ?string,
};

export type FileInfo = {
    +aliases: Array<string>,
    +markers: Markers,
    +error: ?FileErrorDetails,
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

/**
 * Process a file.
 *
 * @returns {boolean} True, if the file was ok; false, if there was a checksum
 * mismatch violation.
 */
export type FileProcessor = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
    log: ILog,
) => Promise<boolean>;

export type normalizePathFn = (relativeFile: string) => ?{
    file: string,
    exists: boolean,
};

export type Options = {
    includeGlobs: Array<string>,
    excludeGlobs: Array<string>,
    autoFix: boolean,
    json: boolean,
    comments: Array<string>,
    dryRun: boolean,
    rootMarker?: ?string,
};

export type NormalizedFileInfo = {
    file: string,
    exists: boolean,
};

export type JsonItem =
    | {
          type: "violation",
          sourceFile: string,
          sourceLine: number,
          targetFile: string,
          targetLine: number,
          message: string,
          fix?: string,
      }
    | {
          type: "error",
          sourceFile: string,
          targetFile: string,
          message: string,
      };

export type OutputFn = (
    options: Options,
    log: ILog,
    jsonItems: Array<JsonItem>,
    violationFileNames: Array<string>,
) => ErrorCode;
