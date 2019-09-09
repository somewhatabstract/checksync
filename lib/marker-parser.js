// @flow
import escapeRegExp from "lodash/escapeRegExp";

import calcChecksum from "./checksum.js";

import type {ILog, Targets} from "./types.js";

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
};

type addMarkerFn = (id: string, checksum: string, targets: Targets) => void;
type normalizePathFn = (relativeFile: string) => string;

/**
 * Convert our tracked targets object into a regular targets object.
 */
const targetsFromTrackedTargets = (trackedTargets: TrackedTargets): Targets => {
    const targets: Targets = ({}: any);

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
    _openMarkers: TrackedMarkers = ({}: any);
    _addMarker: addMarkerFn;
    _normalizePath: normalizePathFn;
    _startTagRegExp: RegExp;
    _endTagRegExp: RegExp;
    _lineNumber: number;

    /**
     * Construct a `MarkerParser` instance.
     *
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
         *     1: The tag id
         *     2: The checksum (optional)
         *     3: The target filename
         *
         * Example:
         *   `// sync-start:tagname 1234567 target.js`
         */
        this._startTagRegExp = new RegExp(
            `^(?:${commentsString})\\s*sync-start:([^\\s]+)\\s+([0-9]*)?\\s*(.*)$`,
        );

        /**
         * This is the regular expression that parses an end tag.
         *
         * Groups:
         *     1: The tag id
         *
         * Example:
         *   `// sync-end:tagname`
         */
        this._endTagRegExp = new RegExp(
            `^(?:${commentsString})\\s*sync-end:([^\\s]+)\\s*$`,
        );
    }

    _recordMarkerStart = (
        id: string,
        file: string,
        line: number,
        checksum: string,
    ) => {
        this._openMarkers[id] = this._openMarkers[id] || {
            content: [],
            targets: ({}: any),
        };

        file = this._normalizePath(file);

        if (this._openMarkers[id].targets[file]) {
            this._log
                .warn(`Target listed multiple times for same marker - ignoring:
    Marker: ${id}
    Target: ${file}`);
            return;
        }

        /**
         * We expect only one entry in our content at this point; the blank
         * line that we add for backwards compatibility.
         */
        if (this._openMarkers[id].content.length !== 0) {
            this._log
                .warn(`Additional target found for marker after content started - ignoring:
    Marker: ${id}
    Target: ${file}`);
            return;
        }

        this._openMarkers[id].targets[file] = {
            line,
            checksum,
        };
    };

    _recordMarkerEnd = (id: string) => {
        const marker = this._openMarkers[id];
        if (marker == null) {
            this._log.warn(`Marker end found, but marker never started:
    Marker: ${id}`);
            return;
        }

        if (marker.content.length === 0) {
            this._log.warn(`Marker has no content:
    Marker: ${id}`);
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
            this._recordMarkerStart(
                startMatch[1],
                startMatch[3],
                lineNumber,
                startMatch[2],
            );
            return;
        }

        const endMatch = this._endTagRegExp.exec(content);
        if (endMatch != null) {
            this._recordMarkerEnd(endMatch[1]);
            return;
        }

        this._addContentToOpenMarkers(content);
    };
}
