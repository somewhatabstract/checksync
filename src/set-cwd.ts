import exit from "./exit";
import {ExitCode} from "./exit-codes";
import {ILog} from "./types";

/**
 * Set the current working directory.
 *
 * This will exit the process if the directory cannot be changed.
 *
 * @param log A log to record things
 * @param directory The directory to set as the current working directory.
 */
export default function setCwd(log: ILog, directory: string): void {
    log.verbose(() => `Changing working directory to ${directory}`);
    try {
        process.chdir(directory);
    } catch (e) {
        log.error(`Unable to set working directory: ${e}`);
        exit(log, ExitCode.CATASTROPHIC);
    }
}
