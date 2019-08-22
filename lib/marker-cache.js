// @flow
/**
 * Cache in which we store our knowledge of existing markers.
 */

import logging from "./logging.js";

// const exampleMarkersA = {
//     filea: {
//         markerA: {
//             fixable: true,
//             checksum: "345678",
//             start: 0,
//             end: 10,
//             targets: [
//                 { file: "fileb", checksum: "2345678" },
//                 { file: "filec", checksum: "2345678" },
//             ],
//         },
//     },
// };

class MarkerCache {
    // TODO: API to collate all markers and allow files to be parsed and the parsed markers to be updated.
    static fromFiles(files: Array<string>): MarkerCache {
        const cache = new MarkerCache();

        for (const file of files) {
            // TODO: Open the file and get its sync markers.
            // - What will they look like? We should match KA webapp so this is
            //   a drop-in replacement.
            // - How do we join more than two files? One marked entry per file
            //   but the same key name? Seems reasonable to allow duplicate key
            //   markers and a single end marker.
            // - Only checksum the non-marker parts so that we don't modify checksums
            //   just because we add more markers.

            // TODO: We're going to open each file and find its sync marked sections.
            // Any target files that are referenced but are not in the input list
            // will be used for checksum generation only; not to process their own
            // marked sections. However, we can use the same parsing processes to make
            // that work for now and just mark sections with "fixable" or not so that
            // we properly modify things if we need to.
            // 1. Build the cache from existing files
            // 2. Report on errors or fix them, depending on --fix flag
            logging.log(file);
        }

        return cache;
    }
}

module.exports = MarkerCache;
