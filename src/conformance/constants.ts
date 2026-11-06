import {ConformanceCase} from "./types";

/**
 * The fixture folder, relative to the repository root, for configuration
 * files that can't be loaded.
 */
const BAD_CONFIG_DIR = "__conformance__/fixtures/bad-config";

/**
 * Cases that cover the command-line surface rather than any one example.
 *
 * These run from the repository root, like the example cases, unless they
 * set a working directory. Each glob they pass matches either a small set of
 * files that are in sync or nothing at all, so that the result shows how the
 * arguments were handled.
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
    {
        id: "cli/bad-config-malformed-json",
        args: ["--config", "malformed.json", "no-tags.txt"],
        cwd: BAD_CONFIG_DIR,
        // The error includes the JSON parser's message and a stack trace.
        stderrPresenceOnly: true,
    },
    {
        id: "cli/bad-config-wrong-type",
        args: ["--config", "wrong-type.json", "no-tags.txt"],
        cwd: BAD_CONFIG_DIR,
    },
    {
        id: "cli/bad-config-unknown-option",
        args: ["--config", "unknown-option.json", "no-tags.txt"],
        cwd: BAD_CONFIG_DIR,
    },
    {
        id: "cli/bad-config-top-level-array",
        args: ["--config", "array.json", "no-tags.txt"],
        cwd: BAD_CONFIG_DIR,
    },
    {
        id: "cli/bad-config-missing-file",
        args: ["--config", "missing.json", "no-tags.txt"],
        cwd: BAD_CONFIG_DIR,
        // The error includes the system's message for a missing file.
        stderrPresenceOnly: true,
    },
    {
        id: "cli/bad-config-relative-path-elsewhere",
        // A relative path is opened after changing to the config file's
        // folder, so it is not found unless that folder is the working one.
        args: ["--config", `${BAD_CONFIG_DIR}/array.json`, "no-tags.txt"],
        stderrPresenceOnly: true,
    },
];
