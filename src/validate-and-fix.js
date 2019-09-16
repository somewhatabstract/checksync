// @flow
import readline from "readline";
import fs from "fs";

import path from "path";
import generateMarkerEdges from "./generate-marker-edges.js";

import type {ILog, MarkerCache} from "./types.js";
import type {MarkerEdge} from "./generate-marker-edges.js";

type EdgeMap = {
    [brokenDeclaration: string]: string,
    ...,
};

/**
 * Format a given edge into a comment with corrected checksum.
 */
const formatEdgeFix = (sourceFile: string, brokenEdge: MarkerEdge): string =>
    `${brokenEdge.sourceComment} sync-start:${brokenEdge.markerID} ${
        brokenEdge.targetChecksum
    } ${path.relative(path.dirname(sourceFile), brokenEdge.targetFile)}`;

/**
 * Generate a map edge from broken declaration to fixed declaration.
 */
const mapEdgeFix = (
    sourceFile: string,
    brokenEdge: MarkerEdge,
): [string, string] => [
    brokenEdge.sourceDeclaration,
    formatEdgeFix(sourceFile, brokenEdge),
];

const validateAndFix = (
    file: string,
    cache: MarkerCache,
    log: ILog,
): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        // First, we need to know what tags we're fixing.
        // Let's make a lookup of old declaration to new.
        const brokenEdges = Array.from(generateMarkerEdges(file, cache, log));
        if (brokenEdges.length === 0) {
            // This shouldn't get here, but if it does, yay! Nothing to do.
            resolve(true);
        }

        const brokenEdgeMap: EdgeMap = brokenEdges
            .map((edge: MarkerEdge) => mapEdgeFix(file, edge))
            .reduce(
                (
                    prev: EdgeMap,
                    [brokenDeclaration, fixedDeclaration]: [string, string],
                ): EdgeMap => {
                    prev[brokenDeclaration] = fixedDeclaration;
                    return prev;
                },
                {},
            );

        // Okay, we have broken edges, so let's make our fix map.

        // Open the file for read/write.
        // We'll use this file descriptor to create our streams for reading
        // and writing the file.
        const fd = fs.openSync(file, "r+");

        // Create a write stream starting at the beginning of the file,
        // because we are going to overwrite as we read.
        const ws = fs
            .createWriteStream(file, {fd, start: 0})
            .once("close", () => {
                resolve(false);
            });

        // Now, we'll read line by line and process what we get against
        // our markers.
        /**
         * TODO(somewhatabstract): This is likely inefficient. We should look
         * at using a pipe from read stream to transform stream to write
         * so that node properly handles back pressure for us and keeps
         * throughput optimal.
         * However, that taks more effort since the transform stream has to be
         * chunk aware to ensure we cope with partial line reads properly.
         */
        readline
            .createInterface({
                input: fs.createReadStream(file, {
                    fd,
                    start: 0,
                    autoClose: false,
                }),
                crlfDelay: Infinity,
                terminal: false,
            })
            .on("line", (line: string) => {
                // Let's see if this is something we need to fix.
                const fix = brokenEdgeMap[line];

                // If we have a fix, use it, otherwise, just output the line
                // as it is (we have to add the newline).
                ws.write(`${fix == null ? line : fix}\n`);
            })
            .on("close", () => {
                // We have finished reading, so let's tell the write stream
                // to finish what it is doing. This will cause it to close.
                // Our close handler for the write stream will then resolve
                // the promise.
                ws.end();
            });
    });
};

export default validateAndFix;
