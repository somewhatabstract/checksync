// @flow
import _ from "lodash";

import logging from "./logging.js";

import type {Targets} from "./types.js";

type TrackedMarker = {
    content: Array<string>,
    targets: $Shape<{
        [target: string]: {
            checksum: string,
            line: number,
        },
    }>,
};

type TrackedMarkers = $Shape<{
    [id: string]: TrackedMarker,
}>;

interface addMarker {
    (id: string, checksum: string, targets: Targets): mixed;
}

export default class MarkerParser {
    _openMarkers: TrackedMarkers = {};
    _addMarker: addMarker;
    _commentRegExp: RegExp;

    constructor(addMarker: addMarker, comments: Array<string>) {
        this._addMarker = addMarker;

        const commentsString = comments
            .map(c => `(${_.escapeRegExp(c)})`)
            .join("|");
        this._commentRegExp = new RegExp(`^${commentsString}.*`);
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

        if (this._openMarkers[id].targets[file]) {
            logging.error(`Target listed multiple times for same marker:
    Marker: ${id}
    Target: ${file}`);
            return;
        }

        if (this._openMarkers[id].content.length !== 0) {
            logging.error(`Additional target added to marker after content started:
    Marker: ${id}
    Target: ${file}`);
        }

        this._openMarkers[id].targets[file] = {
            line,
            checksum,
        };
    };

    _recordMarkerEnd = (id: string) => {
        // TODO
        //    - Throw if marker never opened
        //    - Throw if content has no lines
        //    - Calculate checksum
        //    - Call addMarker with marker info
        //    - Delete marker from open markers
    };

    _addContentToOpenMarkers = (line: string) => {
        for (const id of Object.keys(this._openMarkers)) {
            this._openMarkers[id].content.push(line);
        }
    };

    getOpenMarkerIDs = (): Array<string> => Object.keys(this._openMarkers);

    parseLine = (content: string, index: number): void => {
        content = content.trim();

        if (this._commentRegExp.test(content)) {
            logging.info("COMMENT!");
        }

        // TODO: How do we strip comments? Do we support /* // # what others?
        // TODO: How do we strip them? Regex?
        // TODO: Add command to override the supported comments

        // TODO: On each line:
        // 1. Look for starting markers
        //    If found, record it
        // 2. Look for ending markers
        //    If found, record it
        // 3. If neither start nor end, add line to content for open markers.
        /**
         * Now, we need a state machine to look for and parse markers.
         * 1. Look for start
         *
         * sync-start:markLSDemoDashboardSeen2 1285508815 javascript/learnstorm-dashboard-package/level-zero.jsx
         *
         * 2. Start looking for the end, but know that we might see a new
         *    tag too. Calculate checksum as we go.
         *
         * sync-end:markLSDemoDashboardSeen2
         */
    };
}
