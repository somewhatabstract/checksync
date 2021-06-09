// @flow
import type {FileInfo, Markers} from "./types.js";

/**
 * Copy the given file info, marking markers as unfixable.
 *
 * @export
 * @param {FileInfo} fileInfo The file info to be copied.
 * @returns {FileInfo} The copied file info.
 */
export default function cloneAsUnfixable(fileInfo: FileInfo): FileInfo {
    const {markers, aliases, error} = fileInfo;
    const clonedMarkers: Markers = {};
    for (const key of Object.keys(markers)) {
        clonedMarkers[key] = {
            ...markers[key],
            fixable: false,
        };
    }
    return {
        markers: clonedMarkers,
        aliases,
        error,
    };
}
