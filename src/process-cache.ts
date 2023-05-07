import cwdRelativePath from "./cwd-relative-path";
import generateErrorsForFile from "./generate-errors-for-file";
import OutputSink from "./output-sink";

import {ExitCode} from "./exit-codes";
import {MarkerCache, ILog, Options} from "./types";

export default async function processCache(
    options: Options,
    cache: Readonly<MarkerCache>,
    log: ILog,
): Promise<ExitCode> {
    /**
     * We process the cache file by file, generating errors to be processed.
     */
    const outputSink = new OutputSink(options, log);
    for (const file of Object.keys(cache)) {
        outputSink.startFile(file);
        try {
            for (const errorDetails of generateErrorsForFile(
                options,
                file,
                cache,
            )) {
                outputSink.processError(errorDetails);
            }
        } catch (e: any) {
            log.error(
                `${cwdRelativePath(file)} update encountered error: ${e.stack}`,
            );
        }
        await outputSink.endFile();
    }
    return outputSink.end();
}
