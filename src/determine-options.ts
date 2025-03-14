import findConfigurationFile from "./find-configuration-file";
import loadConfigurationFile from "./load-configuration-file";
import defaultOptions from "./default-options";
import {optionsFromArgs} from "./options-from-args";

import {ILog, MigrationOptions, Options} from "./types";
import {Arguments} from "yargs";
import path from "path";
import setCwd from "./set-cwd";

export default async function determineOptions(
    args: Arguments<any>,
    log: ILog,
): Promise<Options> {
    /**
     * The configuration we return here is a combination of the an RC file,
     * if found or wanted, and the supplied arguments.
     */
    if (args.config === false) {
        log.verbose(() => "Skipping configuration file search");
    }

    const argsOptions = optionsFromArgs(args);
    log.verbose(
        () =>
            `Options from arguments: ${JSON.stringify(
                argsOptions,
                undefined,
                2,
            )}`,
    );

    const configFilePath: string | null | undefined =
        args.config === false
            ? null
            : args.config != null
              ? (args.config as any)
              : findConfigurationFile(args.rootMarker as any, log);

    log.verbose(() => {
        if (!!configFilePath && args.config === configFilePath) {
            return `Using --config file: ${configFilePath}`;
        }
    });

    if (configFilePath != null) {
        // We found a config file.
        // In order for paths defined in the config file to work
        // deterministically, we need to make sure the current working
        // directory is that of the config file.
        // This is intended to override the --cwd argument, so it
        // is expected that the cwd may change twice if there is a --cwd
        // argument that then discovers a config file.
        setCwd(log, path.dirname(configFilePath));
    }

    const configFromFile =
        configFilePath == null
            ? null
            : await loadConfigurationFile(configFilePath, log);
    log.verbose(() =>
        configFromFile == null
            ? null
            : `Options from config: ${JSON.stringify(
                  configFromFile,
                  undefined,
                  2,
              )}`,
    );

    // We have to now build the options, with args taking precedence over
    // config. Then after that, put in any defaults we need.
    const combinedOptions = {
        ...defaultOptions,
        ...configFromFile,
        ...argsOptions,
    };
    // We have to build the combined migrations.
    // Since this is a nested configuration, it's a little different.
    // We only allow the mode to be overridden by args, the mappings always
    // come from config.
    const migrationMode =
        argsOptions?.migration?.mode ?? configFromFile?.migration?.mode;
    const combinedMigrations: MigrationOptions | undefined =
        migrationMode == null || configFromFile?.migration?.mappings == null
            ? undefined
            : {
                  mode: migrationMode,
                  mappings: configFromFile?.migration?.mappings,
              };
    combinedOptions.migration = combinedMigrations;
    log.verbose(
        () =>
            `Combined options with defaults: ${JSON.stringify(
                combinedOptions,
                undefined,
                2,
            )}`,
    );

    return combinedOptions;
}
