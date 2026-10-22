import {ConformanceCase} from "./types";

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
 * Each example is run once per scenario. The `migrate_all` example also
 * passes `--migrate all`, since that is the behavior it exists to cover.
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
        return Object.entries(SCENARIOS).map(([scenario, scenarioArgs]) => ({
            id: `${example}/${scenario}`,
            args: [
                ...scenarioArgs,
                ...migrateArgs,
                `__examples__/${example}/**`,
            ],
        }));
    });
}
