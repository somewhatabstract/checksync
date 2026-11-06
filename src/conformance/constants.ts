import {ConformanceCase} from "./types";

/**
 * Cases that cover the command-line surface rather than any one example.
 *
 * These run from the repository root, like the example cases. Each glob they
 * pass matches either a small example that is in sync or nothing at all, so
 * that the result shows how the arguments were handled.
 */
export const CLI_CASES: ReadonlyArray<ConformanceCase> = [
    {id: "cli/help", args: ["--help"]},
    {id: "cli/help-short-alias", args: ["-h"]},
    {id: "cli/help-question-mark-alias", args: ["-?"]},
    {id: "cli/version", args: ["--version"]},
    {
        id: "cli/unknown-option",
        args: ["--not-an-option", "__examples__/correct_checksums/**"],
    },
    {
        id: "cli/invalid-choice",
        args: ["--migrate", "bogus", "__examples__/correct_checksums/**"],
    },
    {
        id: "cli/conflicting-options",
        args: [
            "--output-cache",
            ".conformance-output/conflicting-options.cache.json",
            "--update-tags",
            "__examples__/correct_checksums/**",
        ],
        // Recorded so that a cache written before the conflict is caught.
        cacheFile: ".conformance-output/conflicting-options.cache.json",
    },
    {id: "cli/no-matching-files", args: ["__examples__/does_not_exist/**"]},
    {
        id: "cli/no-matching-files-json",
        args: ["--json", "__examples__/does_not_exist/**"],
    },
];
