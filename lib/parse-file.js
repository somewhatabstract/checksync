// @flow
/* eslint-disable no-unused-vars */
/**
 * Code to extract and manipulate our sync markers from files.
 */
import readline from "readline";
import fs from "fs";
import util from "util";
import path from "path";

import Format from "./format.js";
import MarkerParser from "./marker-parser.js";

import type {ILog, Markers, Targets} from "./types.js";

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
    logFileRef?: (fileRef: string) => mixed,
): Promise<?Markers> {
    log.group(Format.info("Parsing"), file);

    return new Promise((resolve, reject) => {
        try {
            const markers: Markers = ({}: any);

            const addMarker = (
                id: string,
                checksum: string,
                targets: Targets,
            ): void => {
                if (markers[id]) {
                    log.error(`Marker declared multiple times: ${id}`);
                    return;
                }
                markers[id] = {fixable, checksum, targets};
            };

            const normalizePath = relativeFile =>
                path.resolve(path.dirname(file), relativeFile);

            const markerParser = new MarkerParser(
                normalizePath,
                addMarker,
                comments,
                log,
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
                        log.group(
                            Format.error("These markers are not terminated"),
                        );
                        openMarkerIDs.forEach(id => log.error(id, true));
                        log.groupEnd();
                    }
                    const markerCount = Object.keys(markers).length;
                    const result = markerCount === 0 ? null : markers;

                    if (result == null) {
                        log.log("No terminated markers found");
                    } else {
                        log.log(`Markers found: ${markerCount}`);
                    }
                    resolve(result);
                });
        } catch (e) {
            reject(e);
        }
    })
        .then(null, reason => {
            log.error(`Could not parse file: ${reason.message}`);
            return null;
        })
        .finally(() => log.groupEnd());
}
