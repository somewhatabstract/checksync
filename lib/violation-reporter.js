// @flow
import type {ViolationHandler, ILog} from "./types.js";

const violationReporter: ViolationHandler = function(
    sourceFile: string,
    sourceLine: number,
    targetFile: string,
    markerID: string,
    correctChecksum: string,
    fixable: boolean,
    log: ILog,
): void {
    console.log("REPORT");
    // TODO: Can we sync a marker within the same file? Not really since there could be multiple;
    //       how would we manage that? Let's ban it.
};

export default violationReporter;
