// @flow
import Format from "./format.js";
import cwdRelativePath from "./cwd-relative-path.js";

import type {ViolationHandler, ILog} from "./types.js";

/**
 * Report a detected violation.
 *
 * @param {string} markerID The identifier of the marker.
 * @param {string} sourceFile The file containing the marker.
 * @param {number | string} sourceLine The line that the marker is declared in the source file.
 * @param {string} refChecksum The incorrect checksum of the source reference.
 * @param {string} targetFile The file targeted by the marker.
 * @param {number | string} targetLine The line that the marker is declared in the target.
 * @param {string} targetChecksum The actual correct checksum of the target file
 * marked content.
 * @param {ILog} log The logger for logger messages.
 */
const violationReporter: ViolationHandler = function(
    markerID: string,
    sourceFile: string,
    sourceLine: string | number,
    refChecksum: ?string,
    targetFile: string,
    targetLine: string | number,
    targetChecksum: ?string,
    log: ILog,
): void {
    const NO_CHECKSUM = "No checksum";
    const sourceFileRef = Format.filePath(`${sourceFile}:${sourceLine}`);
    const checksums = `${refChecksum || NO_CHECKSUM} != ${targetChecksum ||
        NO_CHECKSUM}`;
    log.log(
        Format.violation(
            `${sourceFileRef} Looks like you changed the target content for sync-tag '${markerID}' in '${cwdRelativePath(
                targetFile,
            )}:${targetLine}'. Make sure you've made the parallel changes in the source file, if necessary (${checksums})`,
        ),
    );
};

export default violationReporter;
