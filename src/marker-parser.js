// @flow
import escapeRegExp from "lodash/escapeRegExp";

import calcChecksum from "./checksum.js";

import type {ILog, Targets, normalizePathFn} from "./types.js";

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
};

type TrackedTargets = {
    [target: string]: TrackedTarget,
    ...,
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
};

type TrackedMarkers = {
    [id: string]: TrackedMarker,
    ...,
};

type addMarkerFn = (id: string, checksum: string, targets: Targets) => void;

/**
 * Convert our tracked targets object into a regular targets object.
 */
const targetsFromTrackedTargets = (trackedTargets: TrackedTargets): Targets => {
    const targets: Targets = {};

    for (const file of Object.keys(trackedTargets)) {
        const {line, checksum} = trackedTargets[file];
        targets[line] = {
            file,
            checksum,
        };
    }

    return targets;
};

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
    _log: ILog;
    _openMarkers: TrackedMarkers = {};
    _addMarker: addMarkerFn;
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
     * @param {Array<string>} comments - An array of strings that are used to detect the start of single-line comments.
     * @param {ILog} log - Log to record feedback
     */
    constructor(
        normalizePath: normalizePathFn,
        addMarker: addMarkerFn,
        comments: Array<string>,
        log: ILog,
    ) {
        this._addMarker = addMarker;
        this._normalizePath = normalizePath;
        this._log = log;
        this._lineNumber = 0;

        const commentsString = comments
            .map(c => `(?:${escapeRegExp(c)})`)
            .join("|");

        /**
         * This is the regular expression that parses a start tag.
         *
         * Groups:
         *     1:  Maybe the tag details to be decoded
         *
         * Example:
         *   `// sync-start:tagname 1234567 target.js`
         */
        this._startTagRegExp = new RegExp(
            `^(?:${commentsString})\\s*sync-start:(.*)$`,
        );

        /**
         * This regular expression decodes the start tag.
         *
         * Groups:
         *     1: The tag id
         *     2: The checksum (optional)
         *     3: The target filename
         */
        this._startTagDecodeRegExp = new RegExp(
            `^([^\\s]+)\\s+([0-9]*)?\\s*(\\S*)$`,
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
        this._endTagDecodeRegExp = new RegExp(`^(\\S+)\\s*$`);
    }

    _recordMarkerStart = (
        id: string,
        file: string,
        line: number,
        checksum: string,
    ) => {
        this._openMarkers[id] = this._openMarkers[id] || {
            content: [],
            targets: {},
        };

        const normalized = this._normalizePath(file);

        if (normalized == null) {
            // We're not logging targets for this marker.
            return;
        }

        if (!normalized.exists) {
            this._log.error(
                `Sync-tag "${id}" points to "${file}", which does not exist or is a directory`,
            );
            return;
        }

        if (this._openMarkers[id].targets[normalized.file]) {
            this._log.warn(`Duplicate target "${file}" for sync-tag "${id}"`);
            return;
        }

        if (this._openMarkers[id].content.length !== 0) {
            this._log.error(
                `Sync-tag "${id}" target found after content started`,
            );
            return;
        }

        this._openMarkers[id].targets[normalized.file] = {
            line,
            checksum,
        };
    };

    _recordMarkerEnd = (id: string) => {
        const marker = this._openMarkers[id];
        if (marker == null) {
            this._log.warn(
                `Sync-tag "${id}" end found, but sync-tag never started`,
            );
            return;
        }

        if (marker.content.length === 0) {
            this._log.warn(`Sync-tag "${id}" has no content`);
        }

        const checksum = calcChecksum(marker.content);

        delete this._openMarkers[id];
        const targets = targetsFromTrackedTargets(marker.targets);
        this._addMarker(id, checksum, targets);
    };

    _addContentToOpenMarkers = (line: string) => {
        for (const id of Object.keys(this._openMarkers)) {
            this._openMarkers[id].content.push(line);
        }
    };

    /**
     * Return an array of markers that were not terminated.
     *
     * @memberof MarkerParser
     */
    getOpenMarkerIDs = (): Array<string> => Object.keys(this._openMarkers);

    /**
     * Parse a line of content and build into markers as appropriate.
     *
     * This assumes it is being called for each line of a block of text, one
     * line at a time.
     *
     * @memberof MarkerParser
     * @param {string} content The line content to be parsed.
     */
    parseLine = (content: string): void => {
        content = content.trim();
        const lineNumber = this._lineNumber++;

        const startMatch = this._startTagRegExp.exec(content);
        if (startMatch != null) {
            const startDecode = this._startTagDecodeRegExp.exec(startMatch[1]);
            if (startDecode == null) {
                this._log.error(
                    `Malformed sync-start tag found: line ${lineNumber}`,
                );
            } else {
                this._recordMarkerStart(
                    startDecode[1],
                    startDecode[3],
                    lineNumber,
                    startDecode[2],
                );
            }
            return;
        }

        const endMatch = this._endTagRegExp.exec(content);
        if (endMatch != null) {
            const endDecode = this._endTagDecodeRegExp.exec(endMatch[1]);
            if (endDecode == null) {
                this._log.error(
                    `Malformed sync-end tag found: line ${lineNumber}`,
                );
            } else {
                this._recordMarkerEnd(endMatch[1]);
            }
            return;
        }

        this._addContentToOpenMarkers(content);
    };
}
