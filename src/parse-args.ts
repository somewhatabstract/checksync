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
        ])
        .string([
            "cwd",
            "comments",
            "rootMarker",
            "ignore",
            "ignoreFiles",
            "config",
        ])
        .alias("comments", ["c"])
        .alias("dryRun", ["n", "dry-run"])
        .alias("help", ["h", "?"])
        .alias("ignore", ["i"])
        .alias("ignoreFiles", ["ignore-files"])
        .alias("json", ["j"])
        .alias("rootMarker", ["m", "root-marker"])
        .alias("updateTags", ["u", "update-tags"])
        .alias("allowEmptyTags", ["a", "allow-empty-tags"])
        .strictOptions()
        .fail((msg, err, yargs) => {
            log.error(msg);
            exit(log, ExitCode.UNKNOWN_ARGS);
        })
        .showHelpOnFail(false)
        .parse();
