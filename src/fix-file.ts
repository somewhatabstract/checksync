import readline from "readline";
import fs from "fs";

import {
    IPositionLog,
    Options,
    FixAction,
    ErrorDetailsByDeclaration,
} from "./types";

const reportFix = (
    fix: FixAction | null | undefined,
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
                  write: (content: string) => {
                      /*empty*/
                  },
                  end: (cb: () => void) => resolve(),
                  bytesWritten: 0,
              }
            : fs.createWriteStream(file, {fd, start: 0});

        // Now, we'll read line by line and process what we get against
        // our markers. We keep a line counter going so that we apply fixes to
        // the correct lines. Line numbers on 1-based.
        let lineNumber = 1;

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
                // There could be lines with the same text, so we make sure
                // we're targetting the correct line number.
                // Organizing fixes by line number has its own issues and would
                // be a riskier change at this point. This works for our
                // purposes.
                const fix = errorsByDeclaration[lineText]?.find(
                    (e) => e.fix?.line === lineNumber,
                )?.fix;

                // Make sure we update the line number for the next go around.
                lineNumber++;

                // Report the fix.
                reportFix(fix, log);

                // TODO: Determine actual file line-ending and use that rather
                // than assuming \n like we do here.
                if (fix?.type === "delete") {
                    // Don't write anything. We're deleting this line!
                } else if (fix?.type === "replace") {
                    // If we have a fix, use it.
                    ws.write(`${fix.text}\n`);
                } else {
                    // Otherwise, just output the line as it is (we have to add
                    // the newline as readLine strips the line ending).
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
