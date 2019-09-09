// @flow
import type {ViolationHandler, ILog} from "./types.js";

const violationFixer: ViolationHandler = function(
    sourceFile: string,
    sourceLine: number,
    targetFile: string,
    markerID: string,
    correctChecksum: string,
    fixable: boolean,
    log: ILog,
): void {
    console.log("FIX");
    // TODO: Fixing must be from the bottom of the file up so that line numbers
    //       don't change on us
    // TODO: Can we sync a marker within the same file? Not really since there could be multiple;
    //       how would we manage that? Let's ban it.
};

export default violationFixer;
