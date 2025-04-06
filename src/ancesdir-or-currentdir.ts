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
    marker?: string | null,
): string => {
    try {
        // When this method is called, we want ancesdir to start the search inside
        // the same folder as the given file, so we add a fake child onto the file,
        // which ancesdir will strip.
        return ancesdir(path.join(startPath, "__fake__"), marker ?? undefined);
    } catch (e) {
        throw new Error(
            `Unable to locate directory containing marker file "${marker}" from starting location "${startPath}"`,
            {cause: e},
        );
    }
};
