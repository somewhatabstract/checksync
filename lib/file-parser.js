// @flow
/* eslint-disable no-unused-vars */
/**
 * Code to extract and manipulate our sync markers from files.
 */
import readline from "readline";
import fs from "fs";
import util from "util";

// TODO: Fixing must be from the bottom of the file up so that line numbers
//       don't change on us

// TODO: Marker needs a identifier, start line, end line, host file, fixable flag, target file

// TODO: Can we sync a marker within the same file? Not really since there could be multiple;
//       how would we manage that? Let's ban it.

class Marker {}

class File {}

class Target {}

type Markers = {
    [id: string]: Marker,
};

export default function(file: string): Promise<Markers> {
    const rl = readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity,
    });

    return new Promise((resolve, reject) => {
        const markers: Markers = ({}: any);
        rl.on("line", line => {
            /**
             * Now, we need a state machine to look for and parse markers.
             * 1. Look for start
             *
             * sync-start:markLSDemoDashboardSeen2 1285508815 javascript/learnstorm-dashboard-package/level-zero.jsx
             *
             * 2. Start looking for the end, but know that we might see a new
             *    tag too. Calculate checksum as we go.
             *
             * sync-end:markLSDemoDashboardSeen2
             */
        });

        rl.on("close", () => {
            resolve(markers);
        });
    });
}

const collateAllMarkers = files => {};

const collateMarkers = (file, fixable) => {};
