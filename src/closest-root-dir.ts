import {closesdir} from "ancesdir";

/**
 * Roots already found, keyed by marker and then by starting directory.
 */
const cache = new Map<string | undefined, Map<string, string>>();

/**
 * Find the closest directory, starting from the given one, that contains the
 * root marker.
 *
 * Results are memoized for the life of the process, since every file in a
 * directory shares the same root and a run can look it up many times per
 * file. Failed lookups are not memoized.
 *
 * @param dirPath The absolute path of the directory to start the search from.
 * This directory is checked for the marker before its ancestors are.
 * @param marker The root marker to look for, or nullish to use the
 * `ancesdir` default.
 * @returns The absolute path of the closest directory containing the marker.
 * @throws If no directory containing the marker is found.
 */
export default function closestRootDir(
    dirPath: string,
    marker?: string | null,
): string {
    const markerKey = marker ?? undefined;
    let markerCache = cache.get(markerKey);
    if (markerCache == null) {
        markerCache = new Map();
        cache.set(markerKey, markerCache);
    }

    const cached = markerCache.get(dirPath);
    if (cached != null) {
        return cached;
    }

    const rootPath = closesdir(dirPath, markerKey);
    markerCache.set(dirPath, rootPath);
    return rootPath;
}
