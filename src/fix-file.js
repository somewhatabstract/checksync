// @flow
import readline from "readline";
import fs from "fs";

import type {
    IPositionLog,
    Options,
    ErrorDetails,
    ErrorDetailsByDeclaration,
} from "./types.js";

const reportFix = (
    sourceFile: string,
    errorDetail: ErrorDetails,
    log: IPositionLog,
): void => {
    const {fix, location} = errorDetail;

    if (location == null || fix == null) {
        // We can't do anything with this.
        return;
    }
    log.mismatch(fix.description, location.line);
};

export default function fixFile(
    options: Options,
    file: string,
    log: IPositionLog,
    errorsByDeclaration: ErrorDetailsByDeclaration,
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (Object.keys(errorsByDeclaration).length === 0) {
            resolve();
            return;
        }

        // Okay, we have broken edges, so let's make our fix map.

        // Open the file for read/write.
        // We'll use this file descriptor to create our streams for reading
        // and writing the file.
        const fd = fs.openSync(file, "r+");

        // Create a write stream starting at the beginning of the file,
        // because we are going to overwrite as we read.
        const ws = options.dryRun
            ? {
                  write: (content: string) => {},
                  end: () => resolve(),
              }
            : fs.createWriteStream(file, {fd, start: 0}).once("close", () => {
                  resolve();
              });

        // Now, we'll read line by line and process what we get against
        // our markers.
        /**
         * TODO(somewhatabstract): This is likely inefficient. We should look
         * at using a pipe from read stream to transform stream to write
         * so that node properly handles back pressure for us and keeps
         * throughput optimal.
         * However, that takes more effort since the transform stream has to be
         * chunk aware to ensure we cope with partial line reads properly.
         */
        readline
            .createInterface({
                input: fs.createReadStream(file, {
                    fd,
                    start: 0,
                    autoClose: false,
                }),
                crlfDelay: Infinity,
                terminal: false,
            })
            .on("line", (lineText: string) => {
                // Let's see if this is something we need to fix.
                const errorDetails = errorsByDeclaration[lineText];
                if (errorDetails != null) {
                    reportFix(file, errorDetails, log);
                }

                // TODO: Count the lines and make sure we don't append a
                // newline when we don't need to.

                if (errorDetails?.fix?.type === "delete") {
                    // Don't write anything. We're deleting this line!
                } else if (errorDetails?.fix?.type === "replace") {
                    // If we have a fix, use it.
                    ws.write(`${errorDetails?.fix?.text}\n`);
                } else {
                    // Otherwise, just output the line as it is (we have to add
                    // the newline)
                    ws.write(`${lineText}\n`);
                }
            })
            .on("close", () => {
                // We have finished reading, so let's tell the write stream
                // to finish what it is doing. This will cause it to close.
                // Our close handler for the write stream will then resolve
                // the promise.
                ws.end();
            });
    });
}
