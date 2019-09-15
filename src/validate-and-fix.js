// @flow
// import Format from "./format.js";
// import cwdRelativePath from "./cwd-relative-path.js";
// import generateMarkerEdges from "./generate-marker-edges.js";

import type {ILog, MarkerCache} from "./types.js";

const validateAndFix = async (
    file: string,
    cache: MarkerCache,
    log: ILog,
): Promise<boolean> => {
    // TODO: Open the source file for writing.
    let fileWasFixed = false;
    // for (const {
    //     markerID,
    //     sourceLine,
    //     targetLine,
    //     targetFile,
    //     sourceChecksum,
    //     targetChecksum,
    // } of generateMarkerEdges(file, cache, log)) {
    //     violationFiles[file] = true;
    //     // TODO: Write out the fix on the source line
    //     const fixedLine = `${comment} sync-start:${markerID} ${targetChecksum} ${rootRelativePath(targetFile)}`;
    // }
    return !fileWasFixed;
};

export default validateAndFix;
