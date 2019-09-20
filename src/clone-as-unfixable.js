// @flow

import type {FileInfo, Markers} from "./types.js";

/**
 * Copy the given file info, marking markers as unfixable.
 *
 * @export
 * @param {?Markers} markers The markers to be copied.
 * @returns {?Markers} The copied markers.
 */
export default function cloneAsUnfixable(fileInfo: ?FileInfo): ?FileInfo {
    if (fileInfo == null) {
        return fileInfo;
    }

    const {markers, aliases} = fileInfo;
    const clonedMarkers: Markers = {};
    for (const key of Object.keys(markers)) {
        clonedMarkers[key] = {
            ...markers[key],
            fixable: false,
        };
    }
    return {
        markers: clonedMarkers,
        aliases: aliases,
    };
}
