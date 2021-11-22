// @flow
import readline from "readline";
import fs from "fs";

import type {IPositionLog, Options, ErrorDetails, FixAction} from "./types.js";

type ErrorDetailsByDeclaration = {
    [key: string]: Array<ErrorDetails>,
    ...
};

const reportFix = (
    sourceFile: string,
    fix: ?FixAction,
    log: IPositionLog,
): void => {
    if (fix == null) {
        // We can't do anything with this.
        return;
    }

    log.fix(fix.description, fix.line);
};

export default function fixFile(
    options: Options,
    file: string,
    log: IPositionLog,
    errorsByDeclaration: ErrorDetailsByDeclaration,
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (
            errorsByDeclaration == null ||
            Object.keys(errorsByDeclaration).length === 0
        ) {
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
                  end: (cb: () => void) => resolve(),
                  bytesWritten: 0,
              }
            : fs.createWriteStream(file, {fd, start: 0});

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
                // If there are multiple lines with the exact same text,
                // they will both receive the same fix till we track the line
                // number.
                // TODO: Track the line number so we can work with duplicate
                // text.
                // We always fix the first error in the list.
                const fix = errorsByDeclaration[lineText]?.find(
                    (e) => e.fix != null,
                )?.fix;
                reportFix(file, fix, log);

                // TODO: Determine actual file line-ending and use that.
                // TODO: Count the lines and make sure we don't append a
                // newline when we don't need to.
                if (fix?.type === "delete") {
                    // Don't write anything. We're deleting this line!
                    // TODO: Make sure that this is right...maybe we need to
                    // write a blank bit of text?
                } else if (fix?.type === "replace") {
                    // If we have a fix, use it.
                    ws.write(`${fix.text}\n`);
                } else {
                    // Otherwise, just output the line as it is (we have to add
                    // the newline)
                    ws.write(`${lineText}\n`);
                }
            })
            .on("close", () => {
                // We have finished reading, so let's tell the write stream
                // to finish what it is doing. This will cause it to close.
                ws.end(() => {
                    // We truncate the file at the end in case we deleted some
                    // things.
                    fs.truncate(file, ws.bytesWritten, () => resolve());
                });
            });
    });
}
