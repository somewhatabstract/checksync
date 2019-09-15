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

    //     // TODO: fix!
    // }
    return !fileWasFixed;
};

export default validateAndFix;
