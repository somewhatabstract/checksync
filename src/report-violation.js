// @flow
import Format from "./format.js";
import cwdRelativePath from "./cwd-relative-path.js";

import type {ViolationHandler, ILog} from "./types.js";

/**
 * Report a detected violation.
 *
 * @param {string} sourceFile The file containing the marker.
 * @param {number} sourceLine The line that the marker is declared.
 * @param {string} targetFile The file targeted by the marker.
 * @param {string} markerID The identifier of the marker.
 * @param {string} correctChecksum The correct checksum of the target file
 * marked content.
 * @param {boolean} fixable Whether this problem is fixable or not.
 * @param {ILog} log The logger for logger messages.
 */
const violationReporter: ViolationHandler = function(
    sourceFile: string,
    sourceLine: number,
    targetFile: string,
    markerID: string,
    correctChecksum: string,
    fixable: boolean,
    log: ILog,
): void {
    log.log(
        Format.violation(`${cwdRelativePath(sourceFile)}:${sourceLine + 1}:0`),
    );
    // TODO: Can we sync a marker within the same file? Not really since there could be multiple;
    //       how would we manage that? Let's ban it.
};

export default violationReporter;
