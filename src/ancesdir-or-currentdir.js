// @flow
import ancesdir from "ancesdir";
import path from "path";

/**
 * Find a the folder containing the given marker.
 *
 * Unlike ancesdir, this guarantees we look in the same folder as the given
 * path and then its ancestors. This is useful if the start path is a folder
 * already.
 */
export const ancesdirOrCurrentDir = (
    startPath: string,
    marker: ?string,
): string => {
    // When this method is called, we want ancesdir to start the search inside
    // the same folder as the given file, so we add a fake child onto the file,
    // which ancesdir will strip.
    return ancesdir(path.join(startPath, "__fake__"), marker);
};
