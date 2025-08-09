/**
 * Code to extract and manipulate our sync markers from files.
 */
import readline from "readline";
import fs from "fs";

import MarkerParser from "./marker-parser";
import getNormalizedPathInfo from "./get-normalized-path-info";
import * as Errors from "./errors";
import {closesdir} from "ancesdir";
import calcChecksum from "./checksum";

import {
    Markers,
    Targets,
    Options,
    FileParseResult,
    ErrorDetails,
    NoChecksum,
} from "./types";
import path from "path";
import normalizeSeparators from "./normalize-separators";

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
    const rootPath = closesdir(file, options.rootMarker ?? undefined);
    const markers: Markers = {};
    const errors: Array<ErrorDetails> = [];

    const recordError = (e: ErrorDetails): void => {
        errors.push(e);
    };

    const addMarker = (
        id: string,
        relativeFilePath: string,
        content: ReadonlyArray<string> | undefined,
        targets: Targets,
        commentStart: string,
        commentEnd: string,
    ): void => {
        for (const line of Object.keys(targets)) {
            const lineNumber = parseInt(line);
            if ((content?.length ?? 0) === 0 && !options.allowEmptyTags) {
                recordError(Errors.emptyMarker(id, lineNumber));
            }

            if (markers[id]) {
                recordError(Errors.duplicateMarker(id, lineNumber));
            }

            const target = targets[lineNumber];
            if (target.target === file) {
                recordError(Errors.selfTargeting(id, lineNumber));
            }
        }

        markers[id] = {
            contentChecksum:
                content == null ? NoChecksum : calcChecksum(content),
            selfChecksum: calcChecksum([...(content ?? []), relativeFilePath]),
            targets,
            commentStart,
            commentEnd,
        };
    };

    const referencedFiles: Array<string> = [];
    const normalizeTargetPath = (targetRef: string) => {
        const targetInfo = getNormalizedPathInfo(rootPath, targetRef);
        if (!readOnly && targetInfo.exists && targetInfo.type === "local") {
            referencedFiles.push(targetInfo.path);
        }
        return targetInfo;
    };

    return new Promise<FileParseResult>((resolve, reject) => {
        try {
            const markerParser = new MarkerParser(
                normalizeTargetPath,
                (
                    id: string,
                    content: ReadonlyArray<string> | undefined,
                    targets: Targets,
                    commentStart: string,
                    commentEnd: string,
                ) =>
                    addMarker(
                        id,
                        // We need the normalized path of the file we're
                        // processing to include it in the selfChecksum so
                        // that it's the same across different OSes.
                        normalizeSeparators(path.relative(rootPath, file)),
                        content,
                        targets,
                        commentStart,
                        commentEnd,
                    ),
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
            recordError(Errors.couldNotParse(file, reason.message));
            return {
                markers: null,
                referencedFiles: [],
                errors,
                readOnly,
            };
        },
    );
}
