// @flow
import type {ViolationHandler, ILog} from "./types.js";

/**
 * Fix a detected violation.
 *
 * @param {string} sourceFile The file containing the marker.
 * @param {number} sourceLine The line that the marker is declared.
 * @param {string} markerID The identifier of the marker.
 * @param {string} refChecksum The incorrect checksum of the source reference.
 * @param {string} targetFile The file targeted by the marker.
 * @param {string} targetChecksum The actual correct checksum of the target file
 * marked content.
 * @param {boolean} fixable Whether this problem is fixable or not.
 * @param {ILog} log The logger for logger messages.
 */
const violationFixer: ViolationHandler = function(
    sourceFile: string,
    sourceLine: number,
    markerID: string,
    refChecksum: string,
    targetFile: string,
    targetChecksum: string,
    fixable: boolean,
    log: ILog,
): void {};

export default violationFixer;
