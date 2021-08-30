// @flow
import findConfigurationFile from "./find-configuration-file.js";
import loadConfigurationFile from "./load-configuration-file.js";
import defaultOptions from "./default-options.js";

import type {ILog, Options} from "./types.js";
import type {minimistOutput} from "minimist";

export default async function determineOptions(
    args: minimistOutput,
    log: ILog,
): Promise<Options> {
    /**
     * The configuration we return here is a combination of the an RC file,
     * if found or wanted, and the supplied arguments.
     */
    if (args.config === false) {
        log.verbose(() => "Skipping configuration file search");
    }

    const configFilePath =
        args.config === false
            ? null
            : findConfigurationFile(
                  (args.config: any),
                  (args.rootMarker: any),
                  log,
              );

    const configFromFile =
        configFilePath == null
            ? null
            : await loadConfigurationFile(configFilePath, log);

    // We have to now build the options, with args taking precedence over
    // config. Then after that, put in any defaults we need.
    return {
        includeGlobs:
            (args._ && args._.length ? args._ : configFromFile?.includeGlobs) ??
            defaultOptions.includeGlobs,
        excludeGlobs:
            (args.ignore: any)?.split(";").filter((c) => !!c) ??
            configFromFile?.excludeGlobs ??
            defaultOptions.excludeGlobs,
        ignoreFiles:
            (args.ignoreFiles: any) === false
                ? []
                : (args.ignoreFiles: any)?.split(";").filter((c) => !!c) ??
                  configFromFile?.ignoreFiles ??
                  defaultOptions.ignoreFiles,
        autoFix:
            (args.updateTags: any) ??
            configFromFile?.autoFix ??
            defaultOptions.autoFix,
        json: (args.json: any) ?? configFromFile?.json ?? defaultOptions.json,
        comments:
            (args.comments: any)?.split(" ").filter((c) => !!c) ??
            configFromFile?.comments ??
            defaultOptions.comments,
        dryRun:
            (args.dryRun: any) ??
            configFromFile?.dryRun ??
            defaultOptions.dryRun,
        rootMarker:
            (args.rootMarker: any) ??
            configFromFile?.rootMarker ??
            defaultOptions.rootMarker,
    };
}
