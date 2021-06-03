// @flow
import readline from "readline";
import fs from "fs";

import generateMarkerEdges from "./generate-marker-edges.js";
import Format from "./format.js";
import cwdRelativePath from "./cwd-relative-path.js";
import rootRelativePath from "./root-relative-path.js";

import type {ILog, MarkerCache, Options, FileProcessor} from "./types.js";
import type {MarkerEdge} from "./generate-marker-edges.js";

type EdgeMap = {
    [brokenDeclaration: string]: {
        fix: string,
        edge: MarkerEdge,
    },
    ...
};

/**
 * Format a given edge into a comment with corrected checksum.
 */
const formatEdgeFix = (
    sourceFile: string,
    rootMarker: ?string,
    brokenEdge: MarkerEdge,
): string => {
    const {
        markerID,
        targetLine,
        targetFile,
        targetChecksum,
        sourceCommentStart,
        sourceDeclaration,
        sourceCommentEnd,
    } = brokenEdge;

    if (targetLine == null || targetChecksum == null) {
        // This target doesn't exist. We don't "fix" bad references.
        return sourceDeclaration;
    }

    const startOfComment = sourceCommentStart
        ? sourceDeclaration.indexOf(sourceCommentStart)
        : -1;
    const indent =
        startOfComment > 0
            ? sourceDeclaration.substring(0, startOfComment)
            : "";
    return `${indent}${sourceCommentStart} sync-start:${markerID} ${targetChecksum} ${rootRelativePath(
        targetFile,
        rootMarker,
    )}${sourceCommentEnd || ""}`;
};

/**
 * Generate a map edge from broken declaration to fixed declaration.
 */
const mapEdgeFix = (
    sourceFile: string,
    rootMarker: ?string,
    brokenEdge: MarkerEdge,
): [MarkerEdge, string] => [
    brokenEdge,
    formatEdgeFix(sourceFile, rootMarker, brokenEdge),
];

const reportBrokenEdge = (
    sourceFile: string,
    brokenEdge: MarkerEdge,
    log: ILog,
): void => {
    const {
        markerID,
        sourceLine,
        targetLine,
        targetFile,
        sourceChecksum,
        targetChecksum,
    } = brokenEdge;

    if (targetLine == null || targetChecksum == null) {
        log.error(
            `${Format.cwdFilePath(
                targetFile,
            )} does not contain a tag named '${markerID}' that points to '${cwdRelativePath(
                sourceFile,
            )}'`,
        );
        return;
    }

    const NO_CHECKSUM = "No checksum";
    const sourceFileRef = Format.cwdFilePath(`${sourceFile}:${sourceLine}`);
    log.log(
        Format.violation(
            `${sourceFileRef} Updating checksum for sync-tag '${markerID}' referencing '${cwdRelativePath(
                targetFile,
            )}:${targetLine}' from ${
                sourceChecksum || NO_CHECKSUM
            } to ${targetChecksum}.`,
        ),
    );
};

const validateAndFix: FileProcessor = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
    log: ILog,
): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        // First, we need to know what tags we're fixing.
        // Let's make a lookup of old declaration to new.
        const brokenEdges = Array.from(generateMarkerEdges(file, cache));
        if (brokenEdges.length === 0) {
            resolve(true);
            return;
        }

        const brokenEdgeMap: EdgeMap = brokenEdges
            .map((edge: MarkerEdge) =>
                mapEdgeFix(file, options.rootMarker, edge),
            )
            .reduce(
                (
                    prev: EdgeMap,
                    [edge, fixedDeclaration]: [MarkerEdge, string],
                ): EdgeMap => {
                    prev[edge.sourceDeclaration] = {
                        fix: fixedDeclaration,
                        edge: edge,
                    };
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
        const ws = options.dryRun
            ? {
                  write: (content: string) => {},
                  end: () => resolve(false),
              }
            : fs.createWriteStream(file, {fd, start: 0}).once("close", () => {
                  resolve(false);
              });

        // Now, we'll read line by line and process what we get against
        // our markers.
        /**
         * TODO(somewhatabstract): This is likely inefficient. We should look
         * at using a pipe from read stream to transform stream to write
         * so that node properly handles back pressure for us and keeps
         * throughput optimal.
         * However, that takes more effort since the transform stream has to be
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
                const mappedFix = brokenEdgeMap[line];
                if (mappedFix != null) {
                    reportBrokenEdge(file, mappedFix.edge, log);
                }

                // If we have a fix, use it, otherwise, just output the line
                // as it is (we have to add the newline).
                ws.write(`${mappedFix == null ? line : mappedFix.fix}\n`);
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
