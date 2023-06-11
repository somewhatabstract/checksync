import {ExitCode} from "./exit-codes";
import {ILog} from "./types";

/**
 * Exit the process with the given exit code.
 *
 * @param log The log to use for logging.
 * @param code The exit code to exit with.
 * @returns Never. The process exits.
 */
export default function exit(log: ILog, code: ExitCode): never {
    log.verbose(() => `Exiting with code ${code}: ${ExitCode[code]}`);
    process.exit(code);
}
