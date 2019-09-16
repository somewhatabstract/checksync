// @flow
import Format from "./format.js";
import cwdRelativePath from "./cwd-relative-path.js";
import generateMarkerEdges from "./generate-marker-edges.js";

import type {MarkerCache, ILog} from "./types.js";
import type {MarkerEdge} from "./generate-marker-edges.js";

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

    const NO_CHECKSUM = "No checksum";
    const sourceFileRef = Format.filePath(`${sourceFile}:${sourceLine}`);
    const checksums = `${sourceChecksum || NO_CHECKSUM} != ${targetChecksum ||
        NO_CHECKSUM}`;
    log.log(
        Format.violation(
            `${sourceFileRef} Looks like you changed the target content for sync-tag '${markerID}' in '${cwdRelativePath(
                targetFile,
            )}:${targetLine}'. Make sure you've made the parallel changes in the source file, if necessary (${checksums})`,
        ),
    );
};

const validateAndReport = (
    file: string,
    cache: MarkerCache,
    log: ILog,
): Promise<boolean> => {
    let fileNeedsFixing = false;
    for (const brokenEdge of generateMarkerEdges(file, cache, log)) {
        fileNeedsFixing = true;
        reportBrokenEdge(file, brokenEdge, log);
    }
    return Promise.resolve(!fileNeedsFixing);
};

export default validateAndReport;
