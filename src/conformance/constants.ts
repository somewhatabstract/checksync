import {ConformanceCase} from "./types";

/**
 * The fixture folder, relative to the repository root, for configuration
 * files that can't be loaded, along with one that can.
 */
const BAD_CONFIG_DIR = "__conformance__/fixtures/bad-config";

/**
 * The fixture folder, relative to the repository root, for finding a
 * configuration file.
 *
 * Each fixture has its own root marker, so the repository's configuration
 * isn't found. A tagged file there holds only a `%%` sync-end, which is an
 * error when the configuration that recognises `%%` comments is used, and
 * nothing at all otherwise. The path in the error also shows which folder
 * checksync changed to.
 */
const DISCOVERY_DIR = "__conformance__/fixtures/config-discovery";

/**
 * The fixture folder, relative to the repository root, for combining a
 * configuration file with arguments.
 */
const MERGING_DIR = "__conformance__/fixtures/config-merging";

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
        // After naming the file, the error passes on the JSON parser's message
        // and a stack trace.
        stderrFirstLineOnly: true,
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
        // After naming the file, the error passes on the system's message.
        stderrFirstLineOnly: true,
    },
    {
        id: "cli/config-relative-path-elsewhere",
        // A relative path to a config in another folder is opened before
        // changing to that folder, and globs then resolve from there.
        args: ["--config", `${BAD_CONFIG_DIR}/valid.json`, "no-tags.txt"],
    },
    {
        id: "cli/config-discovery-beside-root-marker",
        args: ["**/*.txt"],
        cwd: `${DISCOVERY_DIR}/beside-marker/sub`,
    },
    {
        id: "cli/config-discovery-without-extension",
        args: ["**/*.txt"],
        cwd: `${DISCOVERY_DIR}/rc-without-extension/sub`,
    },
    {
        id: "cli/config-discovery-closest",
        // Nothing is beside the root marker, so the closest one is used.
        args: ["**/*.txt"],
        cwd: `${DISCOVERY_DIR}/closest/a/b`,
    },
    {
        id: "cli/config-discovery-root-marker-beats-closer",
        args: ["**/*.txt"],
        cwd: `${DISCOVERY_DIR}/marker-beats-closer/sub/deeper`,
    },
    {
        id: "cli/config-discovery-default-root-marker",
        // The nearer package.json has its own configuration beside it.
        args: ["**/*.txt"],
        cwd: `${DISCOVERY_DIR}/root-marker-option/sub`,
    },
    {
        id: "cli/config-discovery-root-marker-option",
        args: ["--root-marker", "marker.txt", "**/*.txt"],
        cwd: `${DISCOVERY_DIR}/root-marker-option/sub`,
    },
    {
        id: "cli/config-discovery-no-config",
        args: ["--no-config", "**/*.txt"],
        cwd: `${DISCOVERY_DIR}/beside-marker/sub`,
    },
    {
        id: "cli/config-discovery-explicit-config-wins",
        args: ["--config", "../.checksyncrc.json", "**/*.txt"],
        cwd: `${DISCOVERY_DIR}/root-marker-option/sub`,
    },
    {
        id: "cli/config-discovery-cwd-option",
        args: ["--cwd", `${DISCOVERY_DIR}/beside-marker/sub`, "**/*.txt"],
    },
    {
        id: "cli/config-merging-config-only",
        args: ["**/*.txt"],
        cwd: `${MERGING_DIR}/options`,
    },
    {
        id: "cli/config-merging-comments-argument",
        args: ["--comments", "//", "**/*.txt"],
        cwd: `${MERGING_DIR}/options`,
    },
    {
        id: "cli/config-merging-ignore-argument",
        args: ["--ignore", "nothing/**", "**/*.txt"],
        cwd: `${MERGING_DIR}/options`,
    },
    {
        id: "cli/config-merging-migration-mode-from-config",
        args: ["source.txt"],
        cwd: `${MERGING_DIR}/migration`,
    },
    {
        id: "cli/config-merging-migration-mode-argument",
        args: ["--migrate", "missing", "source.txt"],
        cwd: `${MERGING_DIR}/migration`,
    },
];
