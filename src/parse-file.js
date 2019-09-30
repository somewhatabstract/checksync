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
import FileReferenceLogger from "./file-reference-logger.js";
import getNormalizedTargetFileInfo from "./get-normalized-target-file-info.js";

import type {
    ILog,
    Markers,
    Targets,
    Target,
    normalizePathFn,
    Options,
} from "./types.js";

type ParseResult = {
    markers: ?Markers,
    referencedFiles: Array<string>,
};

/**
 * Parse the given file and extract sync markers.
 *
 * @export
 * @param {string} file The path of the file to be parsed.
 * @param {boolean} fixable Whether markers imported from this file should be
 * considered as fixable.
 * @param {Array<string>} comments An array of strings that specify the comment
 * syntax to look for at the start of marker tags.
 * @param {ILog} log The interface through which to log user feedback.
 * @param {(fileRef: string) => mixed} [logFileRef] A callback to register any
 * target files that are referenced by markers in this file.
 * @returns {Promise<ParseResult>} The promise of the markers this file contains or
 * null if there were no markers or errors.
 */
export default function parseFile(
    options: Options,
    file: string,
    fixable: boolean,
    log: ILog,
): Promise<ParseResult> {
    const rootPath = ancesdir(file, options.rootMarker);
    const fileRefLogger = new FileReferenceLogger(file, log);
    const markers: Markers = {};

    const addMarker = (
        id: string,
        checksum: string,
        targets: Targets,
        comment: string,
    ): void => {
        let outputError = false;
        for (const line of Object.keys(targets)) {
            if (markers[id]) {
                outputError = true;
                fileRefLogger.error(
                    `Sync-tag '${id}' declared multiple times`,
                    line,
                );
            }
            if (targets[line].file === file) {
                outputError = true;
                fileRefLogger.error(
                    `Sync-tag '${id}' cannot target itself`,
                    line,
                );
            }
        }

        markers[id] = {fixable, checksum, targets, comment};
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
                fileRefLogger,
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
                    markerParser.reportUnterminatedMarkers();

                    const markerCount = Object.keys(markers).length;
                    const result = {
                        markers: markerCount === 0 ? null : markers,
                        referencedFiles,
                    };

                    resolve(result);
                });
        } catch (e) {
            reject(e);
        }
    }).then(
        res => res,
        (reason: Error) => {
            fileRefLogger.error(`Could not parse file: ${reason.message}`);
            return {
                markers: null,
                referencedFiles: [],
            };
        },
    );
}
