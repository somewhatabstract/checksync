// @flow
import escapeRegExp from "lodash/escapeRegExp";

import calcChecksum from "./checksum.js";
import {NoChecksum} from "./types.js";
import ErrorCodes from "./error-codes.js";

import type {Targets, normalizePathFn, ErrorDetails} from "./types.js";

type TrackedTarget = {
    /**
     * The checksum for the target as recorded where the target is
     * referenced.
     *
     * @type {string}
     */
    checksum: string,

    /**
     * 0-based index of line where this target was described.
     *
     * @type {number}
     */
    line: number,

    /**
     * The full declaration for this target's sync-tag.
     *
     * @type {string}
     */
    declaration: string,
};

type TrackedTargets = {
    [target: string]: TrackedTarget,
    ...
};

type TrackedMarker = {
    /**
     * The content for which a checksum will be generated.
     *
     * @type {Array<string>}
     */
    content: Array<string>,

    /**
     * The targets recorded for this marker.
     *
     * @type {TrackedTargets}
     */
    targets: TrackedTargets,

    /**
     * The comment start style we detected.
     *
     * @type {string}
     */
    commentStart: string,

    /**
     * The comment end style we detected.
     *
     * @type {string}
     */
    commentEnd: string,
};

type TrackedMarkers = {
    [id: string]: TrackedMarker,
    ...
};

type addMarkerFn = (
    id: string,
    checksum: string,
    targets: Targets,
    commentStart: string,
    commentEnd: string,
) => void;

type recordErrorFn = (error: ErrorDetails) => void;

/**
 * Convert our tracked targets object into a regular targets object.
 */
const targetsFromTrackedTargets = (trackedTargets: TrackedTargets): Targets => {
    const targets: Targets = {};

    for (const file of Object.keys(trackedTargets)) {
        const {line, checksum, declaration} = trackedTargets[file];
        targets[line] = {
            file,
            checksum,
            declaration,
        };
    }

    return targets;
};

const TagDecodeGroup = Object.freeze({
    tagId: 1,
    checksum: 2,
    targetFileName: 3,
    commentEnd: 4,
});

/**
 * Parser to extract sync markers from lines of text.
 *
 * This expects to be given lines in the order they appear in a given text
 * and builds marker information as it goes. When a complete marker is parsed,
 * a callback is invoked, passing the details of that marker to the calling
 * code.
 *
 * @export
 * @class MarkerParser
 */
export default class MarkerParser {
    _openMarkers: TrackedMarkers = {};
    _addMarker: addMarkerFn;
    _recordError: recordErrorFn;
    _normalizePath: normalizePathFn;
    _startTagRegExp: RegExp;
    _startTagDecodeRegExp: RegExp;
    _endTagRegExp: RegExp;
    _endTagDecodeRegExp: RegExp;
    _lineNumber: number;

    /**
     * Construct a `MarkerParser` instance.
     *
     * @param {normalizePathFn} normalizePath - Callback that will normalize a given path.
     * @param {addMarkerFn} addMarker - Callback invoked when a complete marker has been parsed.
     * @param {recordErrorFn} recordError - Callback invoked to record an error.
     * @param {Array<string>} comments - An array of strings that are used to detect the start of single-line comments.
     */
    constructor(
        normalizePath: normalizePathFn,
        addMarker: addMarkerFn,
        recordError: recordErrorFn,
        comments: Array<string>,
    ) {
        this._addMarker = addMarker;
        this._recordError = recordError;
        this._normalizePath = normalizePath;
        this._lineNumber = 1;

        const commentsString = comments
            .map((c) => `(?:${escapeRegExp(c)})`)
            .join("|");

        /**
         * This is the regular expression that parses a start tag.
         *
         * Groups:
         *     1: Comment string
         *     2: Maybe the tag details to be decoded
         *
         * Example:
         *   `// sync-start:tagname 1234567 target.js`
         */
        this._startTagRegExp = new RegExp(
            `^(${commentsString})\\s*sync-start:(.*)$`,
        );

        /**
         * This regular expression decodes the start tag.
         *
         * Groups:
         *     1: The tag id
         *     2: The checksum (optional)
         *     3: The target filename
         *     4: The optional comment end
         *
         * See `TagDecodeGroup` above.
         */
        this._startTagDecodeRegExp = new RegExp(
            `^([^\\s]+)\\s+([0-9]*)?\\s*(\\S*)(\\s+[^\\s\\w]*)?$`,
        );

        /**
         * This is the regular expression that parses an end tag.
         *
         * Groups:
         *     1: Maybe the tag id
         *
         * Example:
         *   `// sync-end:tagname`
         */
        this._endTagRegExp = new RegExp(
            `^(?:${commentsString})\\s*sync-end:(.*)$`,
        );
        /**
         * This is the regular expression that parses the end tag details.
         *
         * Groups:
         *     1: The tag id
         */
        this._endTagDecodeRegExp = new RegExp(`^(\\S+)\\s*\\S*$`);
    }

    _recordMarkerStart: (
        id: string,
        file: string,
        line: number,
        checksum: string,
        commentStart: string,
        commentEnd: string,
        declaration: string,
    ) => void = (
        id: string,
        file: string,
        line: number,
        checksum: string,
        commentStart: string,
        commentEnd: string,
        declaration: string,
    ) => {
        this._openMarkers[id] = this._openMarkers[id] || {
            content: [],
            targets: {},
            commentStart,
            commentEnd,
        };

        const normalized = this._normalizePath(file);
        if (normalized == null) {
            // We're not logging targets for this marker.
            return;
        }

        const target: TrackedTarget = {
            line,
            checksum,
            declaration,
        };

        if (this._openMarkers[id].commentStart !== commentStart) {
            this._recordError({
                reason: `Sync-start tags for '${id}' given in different comment styles. Please use the same style for all sync-start tags that have identical identifiers.`,
                location: {line},
                code: ErrorCodes.differentCommentSyntax,
            });
        }

        if (!normalized.exists) {
            this._recordError({
                reason: `Sync-start for '${id}' points to '${file}', which does not exist or is a directory`,
                location: {line},
                code: ErrorCodes.fileDoesNotExist,
            });
        }

        if (this._openMarkers[id].targets[normalized.file]) {
            this._recordError({
                reason: `Duplicate target '${file}' for sync-tag '${id}'`,
                location: {line},
                code: ErrorCodes.duplicateTarget,
            });
        }

        if (this._openMarkers[id].content.length !== 0) {
            this._recordError({
                reason: `Sync-start for '${id}' found after content started`,
                location: {line},
                code: ErrorCodes.startTagAfterContent,
            });
        }

        this._openMarkers[id].targets[normalized.file] = target;
    };

    _recordMarkerEnd: (id: string, line: number) => void = (
        id: string,
        line: number,
    ) => {
        const marker = this._openMarkers[id];
        delete this._openMarkers[id];
        if (marker == null) {
            this._recordError({
                reason: `Sync-end for '${id}' found, but there was no corresponding sync-start`,
                location: {line},
                code: ErrorCodes.endTagWithoutStartTag,
            });
        } else if (marker.content.length === 0) {
            this._recordError({
                reason: `Sync-tag '${id}' has no content`,
                location: {line},
                code: ErrorCodes.emptyMarker,
            });
        }

        this._addMarker(
            id,
            marker == null ? NoChecksum : calcChecksum(marker.content),
            marker == null ? {} : targetsFromTrackedTargets(marker.targets),
            marker?.commentStart,
            marker?.commentEnd,
        );
    };

    _recordUnterminatedMarkerEnd: (id: string) => void = (id) => {
        const marker = this._openMarkers[id];
        delete this._openMarkers[id];
        const targetFile = Object.keys(marker.targets)[0];
        const {line} = marker.targets[targetFile];
        this._recordError({
            reason: `Sync-start '${id}' has no corresponding sync-end`,
            location: {line},
            code: ErrorCodes.startTagWithoutEndTag,
        });
    };

    _recordBadMarkerStart: (
        match: string,
        commentStart: string,
        line: number,
    ) => void = (match, commentStart, line) => {
        this._recordError({
            reason: `Malformed sync-start: format should be 'sync-start:<label> [checksum] <filename> <optional_comment_end>'`,
            location: {line},
            code: ErrorCodes.malformedStartTag,
        });
    };

    _recordBadMarkerEnd: (match: string, line: number) => void = (
        match,
        line,
    ) => {
        this._recordError({
            reason: `Malformed sync-end: format should be 'sync-end:<label>'`,
            location: {line},
            code: ErrorCodes.malformedEndTag,
        });
    };

    _addContentToOpenMarkers: (line: string) => void = (line: string) => {
        for (const id of Object.keys(this._openMarkers)) {
            this._openMarkers[id].content.push(line + "\n");
        }
    };

    recordUnterminatedMarkers: () => void = () => {
        for (const id of Object.keys(this._openMarkers)) {
            this._recordUnterminatedMarkerEnd(id);
        }
    };

    /**
     * Parse a line of content and build into markers as appropriate.
     *
     * This assumes it is being called for each line of a block of text, one
     * line at a time.
     *
     * @memberof MarkerParser
     * @param {string} content The line content to be parsed.
     */
    parseLine: (content: string) => void = (content: string): void => {
        const lineNumber = this._lineNumber++;

        const tagSearch = content.trim();
        const startMatch = this._startTagRegExp.exec(tagSearch);
        if (startMatch != null) {
            const startDecode = this._startTagDecodeRegExp.exec(startMatch[2]);
            if (startDecode == null) {
                this._recordBadMarkerStart(
                    startMatch[0],
                    startMatch[1],
                    lineNumber,
                );
            } else {
                // Turns out that an empty optional tag group, though typed as
                // string can actually be undefined. So, for the optional bits
                // we'll just make sure they get coerced to empty strings.
                this._recordMarkerStart(
                    startDecode[TagDecodeGroup.tagId],
                    startDecode[TagDecodeGroup.targetFileName],
                    lineNumber,
                    startDecode[TagDecodeGroup.checksum] || "",
                    startMatch[1],
                    startDecode[TagDecodeGroup.commentEnd] || "",
                    content,
                );
            }
            return;
        }

        const endMatch = this._endTagRegExp.exec(tagSearch);
        if (endMatch != null) {
            const endDecode = this._endTagDecodeRegExp.exec(endMatch[1]);
            if (endDecode == null) {
                this._recordBadMarkerEnd(endMatch[0], lineNumber);
            } else {
                this._recordMarkerEnd(endDecode[1], lineNumber);
            }
            return;
        }

        this._addContentToOpenMarkers(content);
    };
}
