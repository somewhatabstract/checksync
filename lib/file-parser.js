// @flow
/* eslint-disable no-unused-vars */
/**
 * Code to extract and manipulate our sync markers from files.
 */
import readline from "readline";
import fs from "fs";
import util from "util";

import logging from "./logging.js";
import MarkerParser from "./marker-parser.js";

import type {Markers, Targets} from "./types.js";

// TODO: Fixing must be from the bottom of the file up so that line numbers
//       don't change on us

// TODO: Marker needs a identifier, start line, end line, host file, fixable flag, target file

// TODO: Can we sync a marker within the same file? Not really since there could be multiple;
//       how would we manage that? Let's ban it.

/**
 * Parse the given file and extract sync markers.
 *
 * @export
 * @param {string} file The path of the file to be parsed.
 * @param {boolean} fixable Whether markers imported from this file should be
 * considered as fixable.
 * @param {(fileRef: string) => mixed} [logFileRef] A callback to register any
 * target files that are referenced by markers in this file.
 * @returns {Promise<Markers>} The promise of the markers this file contains.
 */
export default function parseFile(
    file: string,
    fixable: boolean,
    comments: Array<string>,
    logFileRef?: (fileRef: string) => mixed,
): Promise<Markers> {
    return new Promise((resolve, reject) => {
        logging.info(`Reading ${file}`);

        const markers: Markers = {};

        const addMarker = (id: string, checksum: string, targets: Targets) => {
            if (markers[id]) {
                logging.error(`Marker declared multiple times: ${id}`);
                return;
            }

            markers[id] = {fixable, checksum, targets};
        };
        const markerParser = new MarkerParser(addMarker, comments);

        // Start the parsing.
        let index = 0;
        readline
            .createInterface({
                input: fs.createReadStream(file),
                crlfDelay: Infinity,
            })
            .on("line", (line: string) => markerParser.parseLine(line, index++))
            .on("close", () => {
                const openMarkerIDs = markerParser.getOpenMarkerIDs();
                if (openMarkerIDs.length !== 0) {
                    logging.error(`Not all markers were terminated:
    ${openMarkerIDs.join("\n    ")}`);
                }
                resolve(markers);
            });
    });
}
