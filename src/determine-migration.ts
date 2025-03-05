import rootRelativePath from "./root-relative-path";
import {Options, Target} from "./types";

/**
 * Determine if the target could be migrated.
 */
export const determineMigration = (
    options: Options,
    sourceRef: Target,
): string | undefined => {
    // Does this error relate to a migrateable target?
    const {migratedTarget} = (
        options.migration?.mappings ?? new Map<string, string>()
    )
        .entries()
        .reduce(
            (migration, [from, to]) => {
                const currentTarget = rootRelativePath(
                    sourceRef.target,
                    options.rootMarker,
                );
                // We want the best match, which, since we only check
                // that the target starts with the match, is determined to be
                // the longest match.
                if (
                    currentTarget.startsWith(from) &&
                    from.length > migration.matchLength
                ) {
                    return {
                        matchLength: from.length,
                        // Return the target with the `from` portion
                        // replaced by `to`.
                        migratedTarget: currentTarget.replace(from, to),
                    };
                }
                return migration;
            },
            {
                matchLength: 0,
                migratedTarget: undefined as string | undefined,
            },
        );

    return migratedTarget;
};
