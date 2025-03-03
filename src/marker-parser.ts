import escapeRegExp from "lodash/escapeRegExp";

import {ErrorCode} from "./error-codes";

import {Targets, normalizeTargetFn, ErrorDetails, TargetType} from "./types";

type TrackedTarget = {
    /**
     * The type of the target.
     *
     * Local targets are files we can parse for the return markers.
     * Remote targets are URLs.
     *
     * @type {TargetType}
     */
    type: TargetType;
    /**
     * The checksum for the target as recorded where the target is
     * referenced.
     *
     * @type {string}
     */
    checksum: string;
    /**
     * 0-based index of line where this target was described.
     *
     * @type {number}
     */
    line: number;
    /**
     * The full declaration for this target's sync-tag.
     *
     * @type {string}
     */
    declaration: string;
};

type TrackedTargets = {
    [target: string]: Array<TrackedTarget>;
};

type TrackedMarker = {
    /**
     * The content for which a checksum will be generated.
     *
     * @type {Array<string>}
     */
    content: Array<string>;
    /**
     * The targets recorded for this marker.
     *
     * @type {TrackedTargets}
     */
    targets: TrackedTargets;
    /**
     * The comment start style we detected.
     *
     * @type {string}
     */
    commentStart: string;
    /**
     * The comment end style we detected.
     *
     * @type {string}
     */
    commentEnd: string;
};

type TrackedMarkers = {
    [id: string]: TrackedMarker;
};

type addMarkerFn = (
    id: string,
    content: ReadonlyArray<string> | undefined,
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

    for (const target of Object.keys(trackedTargets)) {
        for (const {line, ...rest} of trackedTargets[target]) {
            targets[line] = {
                target,
                ...rest,
            };
        }
    }

    return targets;
};

const TagDecodeGroup = Object.freeze({
    tagId: 1,
    checksum: 2,
    targetPath: 3,
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
    _normalizePath: normalizeTargetFn;

    _startTagRegExp: string;
    _startTagDecodeRegExp: string;
    _endTagRegExp: string;
    _endTagDecodeRegExp: string;

    _lineNumber: number;

    /**
     * Construct a `MarkerParser` instance.
     *
     * @param {normalizeTargetFn} normalizePath - Callback that will normalize a given path.
     * @param {addMarkerFn} addMarker - Callback invoked when a complete marker has been parsed.
     * @param {recordErrorFn} recordError - Callback invoked to record an error.
     * @param {$ReadOnlyArray<string>} comments - An array of strings that are used to detect the start of single-line comments.
     */
    constructor(
        normalizePath: normalizeTargetFn,
        addMarker: addMarkerFn,
        recordError: recordErrorFn,
        comments: ReadonlyArray<string>,
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
        this._startTagRegExp = `^(${commentsString})\\s*sync-start:(.*)$`;

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
        this._startTagDecodeRegExp = `^([^\\s]+)\\s+([0-9]*)?\\s*(\\S*)(\\s+[^\\s\\w]*)?$`;

        /**
         * This is the regular expression that parses an end tag.
         *
         * Groups:
         *     1: Maybe the tag id
         *
         * Example:
         *   `// sync-end:tagname`
         */
        this._endTagRegExp = `^(?:${commentsString})\\s*sync-end:(.*)$`;

        /**
         * This is the regular expression that parses the end tag details.
         *
         * Groups:
         *     1: The tag id
         */
        this._endTagDecodeRegExp = `^(\\S+)\\s*\\S*$`;
    }

    _recordMarkerStart: (
        id: string,
        targetPath: string,
        line: number,
        checksum: string,
        commentStart: string,
        commentEnd: string,
        declaration: string,
    ) => void = (
        id,
        targetPath,
        line,
        checksum,
        commentStart,
        commentEnd,
        declaration,
    ) => {
        this._openMarkers[id] = this._openMarkers[id] || {
            content: [],
            targets: {},
            commentStart,
            commentEnd,
        };

        const normalizedTargetInfo = this._normalizePath(targetPath);
        const target: TrackedTarget = {
            type: normalizedTargetInfo.type,
            line,
            checksum,
            declaration,
        };

        if (this._openMarkers[id].commentStart !== commentStart) {
            this._recordError({
                markerID: id,
                reason: `Sync-start tags for '${id}' given in different comment styles. Please use the same style for all sync-start tags that have identical identifiers.`,
                location: {line},
                code: ErrorCode.differentCommentSyntax,
            });
        }

        if (!normalizedTargetInfo.exists) {
            this._recordError({
                markerID: id,
                reason: `Sync-start for '${id}' points to '${targetPath}', which does not exist or is a directory`,
                location: {line},
                code: ErrorCode.fileDoesNotExist,
            });
        }

        if (this._openMarkers[id].targets[normalizedTargetInfo.path]) {
            this._recordError({
                markerID: id,
                reason: `Duplicate target for sync-tag '${id}'`,
                location: {line},
                code: ErrorCode.duplicateTarget,
                fix: {
                    type: "delete",
                    description: `Removed duplicate target for sync-tag '${id}'`,
                    declaration,
                    line,
                },
            });
        }

        if (this._openMarkers[id].content.length !== 0) {
            this._recordError({
                markerID: id,
                reason: `Sync-start for '${id}' found after content started`,
                location: {line},
                code: ErrorCode.startTagAfterContent,
            });
        }
        const targets =
            this._openMarkers[id].targets[normalizedTargetInfo.path] || [];
        targets.push(target);
        this._openMarkers[id].targets[normalizedTargetInfo.path] = targets;
    };

    _recordMarkerEnd: (id: string, line: number) => void = (
        id: string,
        line: number,
    ) => {
        const marker = this._openMarkers[id];
        delete this._openMarkers[id];
        if (marker == null) {
            this._recordError({
                markerID: id,
                reason: `Sync-end for '${id}' found, but there was no corresponding sync-start`,
                location: {line},
                code: ErrorCode.endTagWithoutStartTag,
            });
        }

        this._addMarker(
            id,
            marker?.content,
            marker == null ? {} : targetsFromTrackedTargets(marker.targets),
            marker?.commentStart,
            marker?.commentEnd,
        );
    };

    _recordUnterminatedMarkerEnd: (id: string) => void = (id) => {
        const marker = this._openMarkers[id];
        delete this._openMarkers[id];
        const targetFile = Object.keys(marker.targets)[0];
        for (const {line} of marker.targets[targetFile]) {
            this._recordError({
                markerID: id,
                reason: `Sync-start '${id}' has no corresponding sync-end`,
                location: {line},
                code: ErrorCode.startTagWithoutEndTag,
            });
        }
    };

    _recordBadMarkerStart: (
        match: string,
        commentStart: string,
        line: number,
    ) => void = (match, commentStart, line) => {
        this._recordError({
            markerID: null,
            reason: `Malformed sync-start: format should be 'sync-start:<label> [checksum] <filename> <optional_comment_end>'`,
            location: {line},
            code: ErrorCode.malformedStartTag,
        });
    };

    _recordBadMarkerEnd: (match: string, line: number) => void = (
        match,
        line,
    ) => {
        this._recordError({
            markerID: null,
            reason: `Malformed sync-end: format should be 'sync-end:<label>'`,
            location: {line},
            code: ErrorCode.malformedEndTag,
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
        const startMatch = new RegExp(this._startTagRegExp).exec(tagSearch);
        if (startMatch != null) {
            const startDecode = new RegExp(this._startTagDecodeRegExp).exec(
                startMatch[2],
            );
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
                    startDecode[TagDecodeGroup.targetPath],
                    lineNumber,
                    startDecode[TagDecodeGroup.checksum] || "",
                    startMatch[1],
                    startDecode[TagDecodeGroup.commentEnd] || "",
                    content,
                );
            }
            return;
        }

        const endMatch = new RegExp(this._endTagRegExp).exec(tagSearch);
        if (endMatch != null) {
            const endDecode = new RegExp(this._endTagDecodeRegExp).exec(
                endMatch[1],
            );
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
