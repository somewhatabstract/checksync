// @flow
import generateMarkerEdges from "./generate-marker-edges.js";
import rootRelativePath from "./root-relative-path.js";

import type {MarkerCache, MarkerEdge, Options, ILog} from "./types.js";

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

const generateBrokenEdgeMap = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
    log: ILog,
): ?EdgeMap => {
    // First, we need to know what tags we're fixing.
    // Let's make a lookup of old declaration to new.
    const brokenEdges = Array.from(generateMarkerEdges(file, cache, log));
    if (brokenEdges.length === 0) {
        return null;
    }

    return brokenEdges
        .map((edge: MarkerEdge) => mapEdgeFix(file, options.rootMarker, edge))
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
};

export default generateBrokenEdgeMap;
