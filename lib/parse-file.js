// @flow
/* eslint-disable no-unused-vars */
/**
 * Code to extract and manipulate our sync markers from files.
 */
import readline from "readline";
import fs from "fs";
import util from "util";

import Format from "./format.js";
import MarkerParser from "./marker-parser.js";
import ScopedLogger from "./scoped-logger.js";

import type {ILog, Markers, Targets, Target} from "./types.js";

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
 * @returns {Promise<Markers>} The promise of the markers this file contains.
 */
export default function parseFile(
    file: string,
    fixable: boolean,
    comments: Array<string>,
    log: ILog,
    normalizeFileRef?: (fileRef: string) => ?string,
): Promise<?Markers> {
    const scopedLogger = new ScopedLogger(Format.info(file), log);

    const promise = new Promise((resolve, reject) => {
        try {
            const markers: Markers = ({}: any);

            const addMarker = (
                id: string,
                checksum: string,
                targets: Targets,
            ): void => {
                if (markers[id]) {
                    scopedLogger.error(`Marker declared multiple times: ${id}`);
                    return;
                }

                if (
                    Object.values(targets).some(
                        (t: any) => (t: Target).file === file,
                    )
                ) {
                    scopedLogger.error(
                        `File marker cannot target source file: ${id}`,
                    );
                }

                markers[id] = {fixable, checksum, targets};
            };

            const markerParser = new MarkerParser(
                normalizeFileRef || (() => null),
                addMarker,
                comments,
                scopedLogger,
            );

            // Start the parsing.
            readline
                .createInterface({
                    input: fs.createReadStream(file),
                    crlfDelay: Infinity,
                })
                .on("line", (line: string) => markerParser.parseLine(line))
                .on("close", () => {
                    const openMarkerIDs = markerParser.getOpenMarkerIDs();
                    if (openMarkerIDs.length !== 0) {
                        scopedLogger.group(
                            Format.error("Unterminated markers"),
                        );
                        openMarkerIDs.forEach(id =>
                            scopedLogger.error(id, true),
                        );
                        scopedLogger.groupEnd();
                    }
                    const markerCount = Object.keys(markers).length;
                    const result = markerCount === 0 ? null : markers;

                    resolve(result);
                });
        } catch (e) {
            reject(e);
        }
    });

    return promise
        .then(null, reason => {
            scopedLogger.error(`Could not parse file: ${reason.message}`);
            return null;
        })
        .finally(() => scopedLogger.closeScope());
}
