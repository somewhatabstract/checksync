import {ILog, MigrationOptions} from "./types";

type MigrationConfig = {
    mode: "all" | "missing";
    mappings: Array<{
        from: Array<string>;
        to: string;
    }>;
};

/**
 * Load the migration options from the migration configuration.
 *
 * This takes the migration configuration, which maps the intended target
 * prefix to the prefixes that should be migrated to that target prefix, and
 * returns the migration options that can be used to migrate those prefixes.
 *
 * @param migrationConfig The migration configuration.
 * @param log The log to use for reporting errors.
 * @returns The migration options, or undefined if there are no mappings.
 * @throws An error if there are duplicate prefixes in the migration
 * configuration.
 */
export const loadMigrationConfig = (
    migrationConfig: MigrationConfig | undefined,
    log: ILog,
): MigrationOptions | undefined => {
    if (!migrationConfig || migrationConfig.mappings.length === 0) {
        return undefined;
    }

    const prefixToTargetsMappings = new Map<string, Set<string>>();
    for (const {from, to} of migrationConfig.mappings) {
        // The `to` is the migrated target prefix, the `from` is an
        // array of prefixes to migrate to that target prefix. We
        // want to create a one-to-one mapping of pre-migrated
        // prefix to migrated prefix - making sure to capture
        // duplicates and report that as an error. We also want to
        // capture if any prefix is mapped to more than one target
        // prefix and report those. So we actually make a 1 to many
        // mapping of a prefix to the target prefixes it migrates
        // to, then we check for duplication and then calculate the
        // one-to-one mapping.
        for (const prefix of from) {
            const duplicateMappings =
                prefixToTargetsMappings.get(prefix) ?? new Set();
            duplicateMappings.add(to);
            prefixToTargetsMappings.set(prefix, duplicateMappings);
        }
    }

    let hasDuplicatePrefixes = false;
    const mappings = new Map<string, string>();
    for (const [prefix, targets] of prefixToTargetsMappings) {
        if (targets.size > 1) {
            log.error(
                `Prefix ${prefix} is mapped to multiple targets: ${[
                    ...targets,
                ].join(", ")}`,
            );
            hasDuplicatePrefixes = true;
            continue;
        }

        mappings.set(prefix, targets.values().next().value!);
    }
    if (hasDuplicatePrefixes) {
        throw new Error(`Duplicate prefixes in migration configuration`);
    }

    return {
        // Make sure to provide our default value if one wasn't given.
        mode: migrationConfig.mode ?? "missing",
        mappings: Object.fromEntries(mappings),
    };
};
