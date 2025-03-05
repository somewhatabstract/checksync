import cwdRelativePath from "./cwd-relative-path";
import {ErrorCode} from "./error-codes";
import normalizeSeparators from "./normalize-separators";
import rootRelativePath from "./root-relative-path";
import {ErrorDetails, Options} from "./types";

/**
 * Create an error indicating that the file could not be parsed.
 *
 * @param file The path of the file that could not be parsed.
 * @param detail The reason why the file could not be parsed.
 * @returns The error details.
 */
export const couldNotParse = (file: string, detail: string): ErrorDetails => ({
    markerID: null,
    code: ErrorCode.couldNotParse,
    reason: `Could not parse ${file}: ${detail}`,
});

/**
 * Create an error indicating that a different comment style is being used.
 *
 * @param markerID The ID of the marker that is affected.
 * @param line The line number where the marker is located.
 * @returns The error details.
 */
export const differentCommentSyntax = (markerID: string, line: number) => ({
    markerID,
    reason: `Sync-start tags for '${markerID}' given in different comment styles. Please use the same style for all sync-start tags that have identical identifiers.`,
    location: {line},
    code: ErrorCode.differentCommentSyntax,
});

/**
 * Create an error indicating a duplicate marker declaration.
 *
 * @param markerID The ID of the marker that is duplicated.
 * @param line The line number where the marker is located.
 * @returns The error details.
 */
export const duplicateMarker = (
    markerID: string,
    line: number,
): ErrorDetails => ({
    markerID,
    reason: `Sync-tag '${markerID}' declared multiple times`,
    location: {line},
    code: ErrorCode.duplicateMarker,
});

/**
 * Create an error indicating a duplicate target for a marker.
 *
 * @param markerID The ID of the marker that is affected.
 * @param line The line number where the marker is located.
 * @param declaration The declaration of the duplicate target.
 * @returns The error details.
 */
export const duplicateTarget = (
    markerID: string,
    line: number,
    declaration: string,
): ErrorDetails => ({
    markerID,
    reason: `Duplicate target for sync-tag '${markerID}'`,
    location: {line},
    code: ErrorCode.duplicateTarget,
    fix: {
        type: "delete",
        description: `Removed duplicate target for sync-tag '${markerID}'`,
        declaration,
        line,
    },
});

/**
 * Create an error indicating an empty marker.
 *
 * @param markerID The ID of the marker that is empty.
 * @param line The line number where the marker is located.
 * @returns The error details.
 */
export const emptyMarker = (markerID: string, line: number): ErrorDetails => ({
    markerID,
    reason: `Sync-tag '${markerID}' has no content`,
    location: {line},
    code: ErrorCode.emptyMarker,
});

/**
 * Create an error indicating an end tag was found with no start tag.
 *
 * @param markerID The ID of the marker that is affected.
 * @param line The line number where the marker is located.
 * @returns The error details.
 */
export const endTagWithoutStartTag = (
    markerID: string,
    line: number,
): ErrorDetails => ({
    markerID,
    reason: `Sync-end for '${markerID}' found, but there was no corresponding sync-start`,
    location: {line},
    code: ErrorCode.endTagWithoutStartTag,
});

/**
 * Create an error indicating a file for a target does not exist.
 *
 * @param markerID The ID of the marker that is affected.
 * @param line The line number where the marker is located.
 * @param normalizedTargetPath The normalized path of the target file.
 */
export const fileDoesNotExist = (
    markerID: string,
    line: number,
    targetPath: string,
): ErrorDetails => ({
    markerID,
    reason: `Sync-start for '${markerID}' points to '${targetPath}', which does not exist or is a directory`,
    location: {line},
    code: ErrorCode.fileDoesNotExist,
});

/**
 * Create an error indicating a malformed sync-end tag.
 *
 * @param line The line number where the malformed tag is located.
 * @returns The error details.
 */
export const malformedEndTag = (line: number): ErrorDetails => ({
    markerID: null,
    reason: `Malformed sync-end: format should be 'sync-end:<label>'`,
    location: {line},
    code: ErrorCode.malformedEndTag,
});

/**
 * Create an error indicating a malformed sync-start tag.
 *
 * @param line The line number where the malformed tag is located.
 * @returns The error details.
 */
export const malformedStartTag = (line: number): ErrorDetails => ({
    markerID: null,
    reason: `Malformed sync-start: format should be 'sync-start:<label> [checksum] <filename> <optional_comment_end>'`,
    location: {line},
    code: ErrorCode.malformedStartTag,
});

/**
 * Create an error indicating a mismatched checksum for a locally targeted tag.
 *
 * @param markerID The ID of the marker that is affected.
 * @param declaration The original declaration of the marker exhibiting the
 * mismatch.
 * @param targetPath The path of the target tag.
 * @param targetLine The line number where the marker is located.
 * @param lineToBeFixed The line number where the fix should be applied.
 * @param incorrectChecksum The incorrect checksum.
 * @param correctChecksum The correct checksum.
 * @param fixedTag The fixed tag that should replace the mismatched one.
 */
export const mismatchedChecksumForLocalTarget = (
    markerID: string,
    declaration: string,
    targetPath: string,
    targetLine: number,
    lineToBeFixed: number,
    incorrectChecksum: string,
    correctChecksum: string,
    fixedTag: string,
): ErrorDetails => ({
    markerID,
    code: ErrorCode.mismatchedChecksum,
    reason: `Looks like you changed the target content for sync-tag '${markerID}' in '${targetPath}:${
        targetLine
    }'. Make sure you've made corresponding changes in the source file, if necessary (${incorrectChecksum} != ${correctChecksum})`,
    location: {line: targetLine},
    fix: {
        type: "replace",
        line: lineToBeFixed,
        text: fixedTag,
        declaration,
        description: `Updated checksum for sync-tag '${markerID}' referencing '${targetPath}:${targetLine}' from ${incorrectChecksum.toLowerCase()} to ${correctChecksum}.`,
    },
});

/**
 * Create an error indicating a mismatched checksum for a remotely targeted tag.
 *
 * @param markerID The ID of the marker that is affected.
 * @param declaration The original declaration of the marker exhibiting the
 * mismatch.
 * @param targetPath The path of the target tag.
 * @param line The line number where the marker is located.
 * @param incorrectChecksum The incorrect checksum.
 * @param correctChecksum The correct checksum.
 * @param fixedTag The fixed tag that should replace the mismatched one.
 */
export const mismatchedChecksumForRemoteTarget = (
    markerID: string,
    declaration: string,
    targetPath: string,
    line: number,
    incorrectChecksum: string,
    correctChecksum: string,
    fixedTag: string,
): ErrorDetails => ({
    markerID,
    code: ErrorCode.mismatchedChecksum,
    reason: `Looks like you changed the content of sync-tag '${markerID}' or the path of the file that contains the tag. Make sure you've made corresponding changes at ${targetPath}, if necessary (${incorrectChecksum} != ${correctChecksum})`,
    location: {line},
    fix: {
        type: "replace",
        line,
        text: fixedTag,
        declaration,
        description: `Updated checksum for sync-tag '${markerID}' referencing '${targetPath}' from ${incorrectChecksum.toLowerCase()} to ${correctChecksum}.`,
    },
});

/**
 * Create an error indicating the target does not have a return tag.
 *
 * @param markerID The ID of the marker that is affected.
 * @param line The line number where the marker is located.
 * @param targetPath The path of the target that should have the return tag.
 * @returns The error details.
 */
export const noReturnTag = (
    markerID: string,
    line: number,
    targetPath: string,
): ErrorDetails => ({
    markerID,
    reason: `No return tag named '${markerID}' in '${targetPath}'`,
    code: ErrorCode.noReturnTag,
    location: {line},
});

/**
 * Create an error indicating a pending migration for missing local return tag.
 *
 * @param options The options for the current run.
 * @param markerID The ID of the marker that is affected.
 * @param declaration The original declaration of the marker exhibiting the
 * mismatch.
 * @param line The line number where the marker is located.
 * @param absoluteTargetPath The current path of the target tag.
 * @param migratedTarget The target to which the marker should be migrated.
 * @param incorrectChecksum The incorrect checksum.
 * @param correctChecksum The correct checksum.
 * @param fixedTag The fixed tag that should replace the mismatched one.
 * @returns The error details.
 */
export const pendingMigrationForMissingTarget = (
    options: Options,
    markerID: string,
    declaration: string,
    line: number,
    absoluteTargetPath: string,
    migratedTarget: string,
    incorrectChecksum: string,
    correctChecksum: string,
    fixedTag: string,
): ErrorDetails => {
    const currentCwdRelativeTargetPath = cwdRelativePath(absoluteTargetPath);
    const currentRootRelativeTargetPath = normalizeSeparators(
        rootRelativePath(absoluteTargetPath, options.rootMarker),
    );
    return {
        markerID,
        reason: `No return tag named '${markerID}' in '${currentCwdRelativeTargetPath}'. Recommend migration to remote target '${migratedTarget}' and update checksum to ${correctChecksum}.`,
        code: ErrorCode.pendingMigration,
        location: {line},
        fix: {
            type: "replace",
            line,
            text: fixedTag,
            declaration,
            description: `Migrated sync-tag '${markerID}'. Target changed from '${currentRootRelativeTargetPath}' to '${migratedTarget}'. Checksum updated from ${incorrectChecksum.toLowerCase()} to ${correctChecksum}`,
        },
    };
};

/**
 * Create an error indicating a marker that targets itself.
 *
 * @param markerID The ID of the marker that targets itself.
 * @param line The line number where the marker is located.
 * @returns The error details.
 */
export const selfTargeting = (
    markerID: string,
    line: number,
): ErrorDetails => ({
    markerID,
    reason: `Sync-tag '${markerID}' cannot target itself`,
    location: {line},
    code: ErrorCode.selfTargeting,
});

/**
 * Create an error indicating a marker found after the content already started.
 *
 * This is for when a start tag for a marker with the given ID has already
 * been parsed and we're in the middle of parsing the content, when we find
 * another start tag for that same marker.
 *
 * @param markerID The ID of the marker that is affected.
 * @param line The line number where the marker is located.
 * @returns The error details.
 */
export const startTagAfterContent = (
    markerID: string,
    line: number,
): ErrorDetails => ({
    markerID,
    reason: `Sync-start for '${markerID}' found after content started`,
    location: {line},
    code: ErrorCode.startTagAfterContent,
});

/**
 * Create an error indicating a start tag was found with no end tag.
 *
 * @param markerID The ID of the marker that is affected.
 * @param line The line number where the marker is located.
 * @returns The error details.
 */
export const startTagWithoutEndTag = (
    markerID: string,
    line: number,
): ErrorDetails => ({
    markerID,
    reason: `Sync-start '${markerID}' has no corresponding sync-end`,
    location: {line},
    code: ErrorCode.startTagWithoutEndTag,
});
