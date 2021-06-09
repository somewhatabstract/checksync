// @flow
/* eslint-disable no-unused-vars */
/**
 * Code to extract and manipulate our sync markers from files.
 */
import readline from "readline";
import fs from "fs";
import ancesdir from "ancesdir";

import Format from "./format.js";
import MarkerParser from "./marker-parser.js";
import getNormalizedTargetFileInfo from "./get-normalized-target-file-info.js";
import {MarkerError} from "./types.js";

import type {
    ILog,
    Markers,
    Targets,
    Target,
    normalizePathFn,
    Options,
    FileParseResult,
    MarkerErrorDetails,
} from "./types.js";

/**
 * Parse the given file and extract sync markers.
 *
 * @export
 * @param {string} file The path of the file to be parsed.
 * @param {boolean} fixable Whether markers imported from this file should be
 * considered as fixable.
 * @param {Array<string>} comments An array of strings that specify the comment
 * syntax to look for at the start of marker tags.
 * @returns {Promise<FileParseResult>} The promise of the markers this file contains or
 * null if there were no markers or errors.
 */
export default function parseFile(
    options: Options,
    file: string,
    fixable: boolean,
): Promise<FileParseResult> {
    const rootPath = ancesdir(file, options.rootMarker);
    const markers: Markers = {};

    const addMarker = (
        id: string,
        checksum: string,
        targets: Targets,
        commentStart: string,
        commentEnd: string,
        error: ?MarkerErrorDetails,
    ): void => {
        const errors = [];
        if (error != null) {
            errors.push(error);
        }

        for (const line of Object.keys(targets)) {
            const lineNumber = parseInt(line);
            if (markers[id]) {
                errors.push({
                    message: `Sync-tag '${id}' declared multiple times`,
                    line: lineNumber,
                    code: MarkerError.duplicate,
                });
            }

            const target = targets[lineNumber];
            if (target.file === file) {
                errors.push({
                    message: `Sync-tag '${id}' cannot target itself`,
                    line: lineNumber,
                    code: MarkerError.selfTargeting,
                });
            }
        }

        if (markers[id] != null) {
            markers[id] = {
                ...markers[id],
                errors: [...markers[id].errors, ...errors],
            };
            return;
        }

        markers[id] = {
            errors,
            fixable,
            checksum,
            targets,
            commentStart,
            commentEnd,
        };
    };

    const referencedFiles: Array<string> = [];
    const normalizeFileRef = (fileRef: string) => {
        const normalizedFileInfo = getNormalizedTargetFileInfo(
            rootPath,
            fileRef,
        );
        if (fixable && normalizedFileInfo.exists) {
            referencedFiles.push(normalizedFileInfo.file);
        }
        return normalizedFileInfo;
    };

    return new Promise((resolve, reject) => {
        try {
            const markerParser = new MarkerParser(
                normalizeFileRef,
                addMarker,
                options.comments,
            );

            // Open the file synchronously so we get a nice error if the file
            // does not exist or errors in some way during open.
            const fd = fs.openSync(file, "r");
            const fileStream = fs.createReadStream(file, {fd});

            // Start the parsing.
            readline
                .createInterface({
                    input: fileStream,
                    crlfDelay: Infinity,
                })
                .on("line", (line: string) => markerParser.parseLine(line))
                .on("close", () => {
                    markerParser.recordUnterminatedMarkers();

                    const markerCount = Object.keys(markers).length;
                    const result = {
                        markers: markerCount === 0 ? null : markers,
                        referencedFiles,
                        error: null,
                    };

                    resolve(result);
                });
        } catch (e) {
            reject(e);
        }
    }).then(
        (res) => res,
        (reason: Error) => {
            return {
                markers: null,
                referencedFiles: [],
                error: {
                    code: "could-not-parse",
                    message: `Could not parse file: ${reason.message}`,
                },
            };
        },
    );
}
