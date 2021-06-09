// @flow
import rootRelativePath from "./root-relative-path.js";
import generateBrokenEdgeMap from "./generate-broken-edge-map.js";

import type {
    MarkerCache,
    Options,
    JsonItem,
    MarkerEdge,
    FileProcessor,
    ILog,
} from "./types.js";

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

    const relSourceFile = rootRelativePath(sourceFile, options.rootMarker);
    const relTargetFile = rootRelativePath(targetFile, options.rootMarker);

    if (targetLine == null || targetChecksum == null) {
        return {
            type: "error",
            sourceFile: relSourceFile,
            targetFile: relTargetFile,
            message: `${relTargetFile} does not contain a tag named '${markerID}' that points to '${relSourceFile}`,
        };
    }

    const NO_CHECKSUM = "No checksum";

    return {
        type: "violation",
        sourceFile: relSourceFile,
        sourceLine: parseInt(sourceLine, 10),
        targetFile: relTargetFile,
        targetLine: parseInt(targetLine, 10),
        message: `${relSourceFile}:${sourceLine} Updating checksum for sync-tag '${markerID}' referencing '${relTargetFile}:${targetLine}' from ${
            sourceChecksum || NO_CHECKSUM
        } to ${targetChecksum}.`,
        fix: mappedFix.fix,
    };
};

export const getValidateAndJson =
    (items: Array<JsonItem>): FileProcessor =>
    async (
        options: Options,
        file: string,
        cache: $ReadOnly<MarkerCache>,
        log: ILog,
    ): Promise<boolean> => {
        const brokenEdgeMap = generateBrokenEdgeMap(options, file, cache, log);

        if (!brokenEdgeMap) {
            return true;
        }

        for (const line of Object.keys(brokenEdgeMap)) {
            const mappedFix = brokenEdgeMap[line];
            items.push(reportBrokenEdge(options, file, mappedFix));
        }

        return items.length === 0;
    };
