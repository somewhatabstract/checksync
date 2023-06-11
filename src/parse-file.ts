/**
 * Code to extract and manipulate our sync markers from files.
 */
import readline from "readline";
import fs from "fs";

import MarkerParser from "./marker-parser";
import getNormalizedTargetFileInfo from "./get-normalized-target-file-info";
import {ErrorCode} from "./error-codes";
import {ancesdirOrCurrentDir} from "./ancesdir-or-currentdir";

import {
    Markers,
    Targets,
    Options,
    FileParseResult,
    ErrorDetails,
} from "./types";

/**
 * Parse the given file and extract sync markers.
 *
 * @export
 * @param {string} file The path of the file to be parsed.
 * @param {boolean} readOnly Whether this file is considered read-only or not.
 * @param {Array<string>} comments An array of strings that specify the comment
 * syntax to look for at the start of marker tags.
 * @returns {Promise<FileParseResult>} The promise of the markers this file contains or
 * null if there were no markers or errors.
 */
export default function parseFile(
    options: Options,
    file: string,
    readOnly: boolean,
): Promise<FileParseResult> {
    // We want ancesdir to start the search inside the same folder as the file
    // we're parsing, so we add a fake child onto it that ancesdir will strip.
    const rootPath = ancesdirOrCurrentDir(file, options.rootMarker);
    const markers: Markers = {};
    const errors: Array<ErrorDetails> = [];

    const recordError = (e: ErrorDetails): void => {
        errors.push(e);
    };

    const addMarker = (
        id: string,
        checksum: string,
        targets: Targets,
        commentStart: string,
        commentEnd: string,
    ): void => {
        for (const line of Object.keys(targets)) {
            const lineNumber = parseInt(line);
            if (markers[id]) {
                recordError({
                    reason: `Sync-tag '${id}' declared multiple times`,
                    location: {
                        line: lineNumber,
                    },
                    code: ErrorCode.duplicateMarker,
                });
            }

            const target = targets[lineNumber];
            if (target.file === file) {
                recordError({
                    reason: `Sync-tag '${id}' cannot target itself`,
                    location: {
                        line: lineNumber,
                    },
                    code: ErrorCode.selfTargeting,
                });
            }
        }

        markers[id] = {
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
        if (!readOnly && normalizedFileInfo.exists) {
            referencedFiles.push(normalizedFileInfo.file);
        }
        return normalizedFileInfo;
    };

    return new Promise<FileParseResult>((resolve, reject) => {
        try {
            const markerParser = new MarkerParser(
                normalizeFileRef,
                addMarker,
                recordError,
                options.comments,
            );

            // Open the file synchronously so we get a nice error if the file
            // does not exist or errors in some way during open.
            const fd = fs.openSync(file, "r");
            const fileStream = fs.createReadStream(file, {fd});

            let lineCount = 0;

            // Start the parsing.
            readline
                .createInterface({
                    input: fileStream,
                    crlfDelay: Infinity,
                })
                .on("line", (line: string) => {
                    lineCount++;
                    markerParser.parseLine(line);
                })
                .on("close", () => {
                    markerParser.recordUnterminatedMarkers();

                    const markerCount = Object.keys(markers).length;
                    const result = {
                        markers: markerCount === 0 ? null : markers,
                        referencedFiles,
                        errors,
                        lineCount,
                    } as const;

                    resolve({...result, readOnly});
                });
        } catch (e: any) {
            reject(e);
        }
    }).then(
        (res) => res,
        (reason: Error) => {
            recordError({
                code: ErrorCode.couldNotParse,
                reason: `Could not parse file: ${reason.message}`,
            });
            return {
                markers: null,
                referencedFiles: [],
                errors,
                readOnly,
            };
        },
    );
}
