import fs from "fs";

import readLines from "./read-lines";

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

        // Open the file for writing. Opening it synchronously gives a clear
        // error straight away if the file can't be written.
        const fd = fs.openSync(file, "r+");

        // Create a write stream starting at the beginning of the file. The
        // whole file is read before anything is written, so overwriting it
        // can't affect what we read.
        const ws = options.dryRun
            ? {
                  write: (content: string) => {
                      /*empty*/
                  },
                  end: (cb: () => void) => resolve(),
                  bytesWritten: 0,
              }
            : fs.createWriteStream(file, {fd, start: 0});

        // Read the file's lines and check each one against our fixes.
        readLines(file).then((lines) => {
            lines.forEach((lineText, index) => {
                // Line numbers are 1-based.
                const lineNumber = index + 1;

                // There could be lines with the same text, so we make sure
                // we're targetting the correct line number.
                // Organizing fixes by line number has its own issues and would
                // be a riskier change at this point. This works for our
                // purposes.
                const fix = errorsByDeclaration[lineText]?.find(
                    (e) => e.fix?.line === lineNumber,
                )?.fix;

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
                    // the newline as the line ending isn't kept).
                    ws.write(`${lineText}\n`);
                }
            });

            // We have finished reading, so let's tell the write stream
            // we're done, and truncate the file to the size we wrote.
            ws.end(() => {
                fs.truncate(file, ws.bytesWritten, () => resolve());
            });
        }, reject);
    });
}
