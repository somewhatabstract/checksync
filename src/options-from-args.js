// @flow
import type {Options} from "./types.js";
import type {minimistOutput} from "minimist";

/**
 * Convert arguments to options.
 */
export const optionsFromArgs = (args: minimistOutput): $Shape<Options> => {
    const options: $Shape<Options> = {};
    if (args._ && args._.length > 0) {
        options.includeGlobs = args._;
    }

    const excludeGlobs = (args.ignore: any)?.split(";").filter((c) => !!c);
    if (excludeGlobs != null) {
        options.excludeGlobs = excludeGlobs;
    }

    // False means don't even add default ignore files
    const ignoreFiles =
        (args.ignoreFiles: any) === false
            ? []
            : (args.ignoreFiles: any)?.split(";").filter((c) => !!c);
    if (ignoreFiles != null) {
        options.ignoreFiles = ignoreFiles;
    }

    if (args.updateTags != null) {
        options.autoFix = !!args.updateTags;
    }

    if (args.json != null) {
        options.json = !!args.json;
    }

    const comments = (args.comments: any)?.split(" ").filter((c) => !!c);
    if (comments != null) {
        options.comments = comments;
    }

    if (args.dryRun != null) {
        options.dryRun = !!args.dryRun;
    }

    if (args.rootMarker != null) {
        options.rootMarker = (args.rootMarker: any);
    }

    return options;
};
