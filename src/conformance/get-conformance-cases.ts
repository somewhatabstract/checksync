import {ConformanceCase} from "./types";

/**
 * The directory, relative to the repository root, that cache files are
 * written to.
 */
const CACHE_DIR = ".conformance-output";

/**
 * Scenario names, mapped to the arguments that select them.
 */
const SCENARIOS: Record<string, ReadonlyArray<string>> = {
    "check-only": [],
    json: ["--json"],
    "autofix-dry-run": ["--update-tags", "--dry-run"],
};

/**
 * Get the conformance cases for the given examples.
 *
 * Each example is run once per scenario, and once more with `--output-cache`
 * so that the marker cache it writes can be recorded too. The `migrate_all`
 * example also passes `--migrate all`, since that is the behavior it exists
 * to cover.
 *
 * @param examples The names of the directories within `__examples__`.
 * @returns The cases, ordered by example and then by scenario.
 */
export default function getConformanceCases(
    examples: ReadonlyArray<string>,
): Array<ConformanceCase> {
    return examples.flatMap((example) => {
        const migrateArgs =
            example === "migrate_all" ? ["--migrate", "all"] : [];
        const glob = `__examples__/${example}/**`;
        const cacheFile = `${CACHE_DIR}/${example}.cache.json`;
        return [
            ...Object.entries(SCENARIOS).map(([scenario, scenarioArgs]) => ({
                id: `${example}.${scenario}`,
                args: [...scenarioArgs, ...migrateArgs, glob],
            })),
            {
                id: `${example}.output-cache`,
                args: ["--output-cache", cacheFile, ...migrateArgs, glob],
                cacheFile,
            },
        ];
    });
}
