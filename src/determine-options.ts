import findConfigurationFile from "./find-configuration-file";
import loadConfigurationFile from "./load-configuration-file";
import defaultOptions from "./default-options";
import {optionsFromArgs} from "./options-from-args";

import {ILog, Options} from "./types";
import {ParsedArgs} from "minimist";

export default async function determineOptions(
    args: ParsedArgs,
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
    log.verbose(() => `Options from arguments: ${JSON.stringify(argsOptions)}`);

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

    const configFromFile =
        configFilePath == null
            ? null
            : await loadConfigurationFile(configFilePath, log);
    log.verbose(() =>
        configFromFile == null
            ? null
            : `Options from config: ${JSON.stringify(configFromFile)}`,
    );

    // We have to now build the options, with args taking precedence over
    // config. Then after that, put in any defaults we need.
    const combinedOptions = {
        ...defaultOptions,
        ...configFromFile,
        ...argsOptions,
    } as const;
    log.verbose(
        () =>
            `Combined options with defaults: ${JSON.stringify(
                combinedOptions,
            )}`,
    );

    return combinedOptions;
}
