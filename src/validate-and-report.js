// @flow
import Format from "./format.js";
import cwdRelativePath from "./cwd-relative-path.js";
import generateMarkerEdges from "./generate-marker-edges.js";

import type {
    MarkerCache,
    ILog,
    Options,
    FileProcessor,
    MarkerEdge,
} from "./types.js";

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
    const checksums = `${sourceChecksum || NO_CHECKSUM} != ${
        targetChecksum || NO_CHECKSUM
    }`;
    log.log(
        Format.violation(
            `${sourceFileRef} Looks like you changed the target content for sync-tag '${markerID}' in '${cwdRelativePath(
                targetFile,
            )}:${targetLine}'. Make sure you've made the parallel changes in the source file, if necessary (${checksums})`,
        ),
    );
};

const validateAndReport: FileProcessor = (
    options: Options,
    file: string,
    cache: $ReadOnly<MarkerCache>,
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
