import {Marker} from "./types";

type TargetDetails = {
    line: number;
    checksum: string;
};

/**
 * Get the line number and checksum of target referencing a given alias.
 *
 * Given a target marker and a list of aliases, return the line number and
 * checksum of the first target that points to one of the given aliases.
 *
 * @param targetMarker The marker to search for targets in.
 * @param aliases The list of aliases to search for.
 * @returns The line number and checksum of the target, or null if no target
 *          references any of the given aliases.
 */
export const getTargetDetailsForAlias = (
    targetMarker: Marker | null | undefined,
    aliases: ReadonlyArray<string>,
): TargetDetails | null => {
    if (targetMarker == null) {
        return null;
    }
    // We look for a target that points to one of the given aliases - a file
    // is considered its own alias, so it will be in the aliases array.
    const matchingEntry = Object.entries(targetMarker.targets).find(
        ([_lineNo, target]) => aliases.includes(target.target),
    );
    if (matchingEntry == null) {
        return null;
    }
    const [lineAsString] = matchingEntry;
    return {
        // We grab the line number of the first target file sync-start
        // tag for this markerID and return that as the target line.
        // This will allow us to identify the target content in our
        // messaging to the user.
        // The first index is the target, the second index is the key
        // of that target, which equates to its line number.
        line: parseInt(lineAsString),
        checksum: targetMarker.contentChecksum,
    };
};
