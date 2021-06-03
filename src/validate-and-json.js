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
    jsonItems: Array<JsonItem>,
): void => {
    const {
        markerID,
        sourceLine,
        targetLine,
        targetFile,
        sourceChecksum,
        targetChecksum,
    } = mappedFix.edge;

    if (targetLine == null || targetChecksum == null) {
        jsonItems.push({
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
        });
        return;
    }

    const NO_CHECKSUM = "No checksum";
    const sourceFileRef = rootRelativePath(
        `${sourceFile}:${sourceLine}`,
        options.rootMarker,
    );
    jsonItems.push({
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
    });
};

const validateAndJson = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
    jsonItems: Array<JsonItem>,
): void => {
    const brokenEdgeMap = generateBrokenEdgeMap(options, file, cache);

    if (!brokenEdgeMap) {
        return;
    }

    for (const line of Object.keys(brokenEdgeMap)) {
        const mappedFix = brokenEdgeMap[line];
        reportBrokenEdge(options, file, mappedFix, jsonItems);
    }
};

export default validateAndJson;
