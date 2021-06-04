// @flow
import rootRelativePath from "./root-relative-path.js";
import generateBrokenEdgeMap from "./generate-broken-edge-map.js";

import type {MarkerCache, Options, JsonItem, MarkerEdge} from "./types.js";

const reportBrokenEdge = (
    options: Options,
    sourceFile: string,
    mappedFix: {
        fix: string,
        edge: MarkerEdge,
    },
): JsonItem => {
    const {
        markerID,
        sourceLine,
        targetLine,
        targetFile,
        sourceChecksum,
        targetChecksum,
    } = mappedFix.edge;

    if (targetLine == null || targetChecksum == null) {
        return {
            type: "error",
            sourceFile: sourceFile,
            targetFile: targetFile,
            message: `${rootRelativePath(
                targetFile,
                options.rootMarker,
            )} does not contain a tag named '${markerID}' that points to '${rootRelativePath(
                sourceFile,
                options.rootMarker,
            )}`,
        };
    }

    const NO_CHECKSUM = "No checksum";
    const sourceFileRef = rootRelativePath(
        `${sourceFile}:${sourceLine}`,
        options.rootMarker,
    );

    return {
        type: "violation",
        sourceFile: rootRelativePath(sourceFile, options.rootMarker),
        sourceLine: sourceLine,
        targetFile: rootRelativePath(targetFile, options.rootMarker),
        targetLine: targetLine,
        message: `${sourceFileRef} Updating checksum for sync-tag '${markerID}' referencing '${rootRelativePath(
            targetFile,
            options.rootMarker,
        )}:${targetLine}' from ${
            sourceChecksum || NO_CHECKSUM
        } to ${targetChecksum}.`,
        fix: mappedFix.fix,
    };
};

const validateAndJson = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
): Array<JsonItem> => {
    const brokenEdgeMap = generateBrokenEdgeMap(options, file, cache);

    if (!brokenEdgeMap) {
        return [];
    }

    const result: Array<JsonItem> = [];
    for (const line of Object.keys(brokenEdgeMap)) {
        const mappedFix = brokenEdgeMap[line];
        result.push(reportBrokenEdge(options, file, mappedFix));
    }
    return result;
};

export default validateAndJson;
