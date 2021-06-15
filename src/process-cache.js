// @flow
import cwdRelativePath from "./cwd-relative-path.js";
import Format from "./format.js";
import generateErrorsForFile from "./generate-errors-for-file.js";
import OutputSink from "./output-sink.js";

import type {ExitCode} from "./exit-codes.js";
import type {MarkerCache, ILog, Options} from "./types";

export default async function processCache(
    options: Options,
    cache: $ReadOnly<MarkerCache>,
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
        } catch (e) {
            log.error(
                `${Format.cwdFilePath(
                    cwdRelativePath(file),
                )} update encountered error: ${e.stack}`,
            );
        } finally {
            await outputSink.endFile();
        }
    }
    return outputSink.end();
}
