import fs from "fs";
import path from "path";

import {GoldenOutcome} from "./types";

/**
 * Compare a transcript with its golden file, or record it as the new golden.
 *
 * When the transcript doesn't match, it is written alongside the golden file
 * with an `.actual.txt` extension so that the two can be diffed.
 *
 * @param goldenPath The path of the golden file.
 * @param transcript The transcript to check or record.
 * @param update Whether to record the transcript as the golden file rather
 * than check it.
 * @returns The outcome of the check, or `"updated"` when recording.
 */
export default function checkGolden(
    goldenPath: string,
    transcript: string,
    update: boolean,
): GoldenOutcome {
    if (update) {
        fs.mkdirSync(path.dirname(goldenPath), {recursive: true});
        fs.writeFileSync(goldenPath, transcript, "utf8");
        return "updated";
    }

    if (!fs.existsSync(goldenPath)) {
        return "missing";
    }

    if (fs.readFileSync(goldenPath, "utf8") === transcript) {
        return "match";
    }

    fs.writeFileSync(
        goldenPath.replace(/\.txt$/, ".actual.txt"),
        transcript,
        "utf8",
    );
    return "mismatch";
}
