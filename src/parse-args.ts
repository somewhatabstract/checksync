// We don't need coverage of this file...it's just yargs stuff.
/* istanbul ignore file */
import yargs from "yargs/yargs";
import {hideBin} from "yargs/helpers";
import {ExitCode} from "./exit-codes";
import exit from "./exit";
import {ILog} from "./types";

export const parseArgs = (log: ILog) =>
    yargs(hideBin(process.argv))
        .help(false)
        .version(false)
        .boolean([
            "updateTags",
            "dryRun",
            "help",
            "verbose",
            "version",
            "json",
            "allowEmptyTags",
            "includeDotPaths",
        ])
        .string([
            "cwd",
            "comments",
            "rootMarker",
            "ignore",
            "ignoreFiles",
            "config",
            "outputCache",
            "fromCache",
            "migrate",
        ])
        .option("includeDotPaths", {
            type: "boolean",
            description:
                "Include paths that begin with a dot, e.g. '.gitignore' when parsing `includeGlobs`. This is default behavior.",
            conflicts: ["help", "version", "fromCache"],
        })
        .option("outputCache", {
            type: "string",
            description: "Path to the output cache file.",
            conflicts: ["updateTags", "dryRun", "help", "version"],
        })
        .option("fromCache", {
            type: "string",
            description: "Path to the input cache file.",
            conflicts: [
                "comments",
                "ignore",
                "ignoreFiles",
                "config",
                "outputCache",
                "help",
                "version",
                "includeDotPaths",
            ],
        })
        .option("migrate", {
            type: "string",
            choices: ["all", "missing"],
            description: "Migrate all or only unreturned tags",
            conflicts: ["help", "version"],
        })
        .alias("comments", ["c"])
        .alias("dryRun", ["n", "dry-run"])
        .alias("help", ["h", "?"])
        .alias("ignore", ["i"])
        .alias("ignoreFiles", ["ignore-files"])
        .alias("json", ["j"])
        .alias("rootMarker", ["m", "root-marker"])
        .alias("updateTags", ["u", "update-tags"])
        .alias("allowEmptyTags", ["a", "allow-empty-tags"])
        .alias("outputCache", ["o", "output-cache"])
        .alias("fromCache", ["f", "use-cache"])
        .alias("includeDotPaths", ["d", "include-dot-paths"])
        .strictOptions()
        .fail((msg, err, yargs) => {
            log.error(msg);
            exit(log, ExitCode.UNKNOWN_ARGS);
        })
        .showHelpOnFail(false)
        .parse();
