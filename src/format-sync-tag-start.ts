/**
 * Create a sync tag start string.
 *
 * This does not include indentation. Callers are responsible for adding any
 * necessary indentation.
 *
 * @param markerID The ID of the marker.
 * @param commentStart The comment start string.
 * @param commentEnd The comment end string.
 * @param checksum The checksum.
 * @param target The target the sync tag points to.
 * @returns The formatted sync tag start string, without indentation.
 */
export const formatSyncTagStart = (
    markerID: string,
    commentStart: string,
    commentEnd: string | undefined | null,
    checksum: string,
    target: string,
): string => {
    return `${commentStart} sync-start:${markerID} ${checksum} ${target}${commentEnd || ""}`;
};
