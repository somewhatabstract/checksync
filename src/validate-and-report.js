// @flow
import cwdRelativePath from "./cwd-relative-path.js";
import generateMarkerEdges from "./generate-marker-edges.js";
import FileReferenceLogger from "./file-reference-logger.js";
import {NoChecksum} from "./types.js";

import type {
    MarkerCache,
    ILog,
    Options,
    FileProcessor,
    MarkerEdge,
    IPositionLog,
} from "./types.js";

const reportBrokenEdge = (
    sourceFile: string,
    brokenEdge: MarkerEdge,
    log: IPositionLog,
): boolean => {
    const {
        markerID,
        sourceLine,
        targetLine,
        targetFile,
        sourceChecksum,
        targetChecksum,
        errors,
    } = brokenEdge;

    if (targetLine == null) {
        // If we don't have a target, then we can't report a violation.
        return false;
    }

    if (
        targetFile === sourceFile ||
        targetChecksum === sourceChecksum ||
        errors.length > 0
    ) {
        // Nothing to fix here.
        // The source checksum being unset means a bad edge beyond fixing.
        // And if the checksums match, then there's nothing to fix.
        return false;
    }

    const checksums = `${sourceChecksum || NoChecksum} != ${
        targetChecksum || NoChecksum
    }`;
    log.mismatch(
        `Looks like you changed the target content for sync-tag '${markerID}' in '${cwdRelativePath(
            targetFile,
        )}:${targetLine}'. Make sure you've made the parallel changes in the source file, if necessary (${checksums})`,
        sourceLine,
    );
    return true;
};

const validateAndReport: FileProcessor = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
    log: ILog,
): Promise<boolean> => {
    const fileRefLogger = new FileReferenceLogger(file, log);
    let fileNeedsFixing = false;
    for (const brokenEdge of generateMarkerEdges(file, cache, fileRefLogger)) {
        fileNeedsFixing =
            fileNeedsFixing ||
            reportBrokenEdge(file, brokenEdge, fileRefLogger);
    }
    return Promise.resolve(!fileNeedsFixing);
};

export default validateAndReport;
