import {Options} from "./types";
import {ParsedArgs} from "minimist";

/**
 * Convert arguments to options.
 */
export const optionsFromArgs = (args: ParsedArgs): Partial<Options> => {
    const options: Partial<Options> = {};
    if (args._ && args._.length > 0) {
        options.includeGlobs = args._;
    }

    const excludeGlobs = (args.ignore as any)
        ?.split(";")
        .filter((c: string) => !!c);
    if (excludeGlobs != null) {
        options.excludeGlobs = excludeGlobs;
    }

    // False means don't even add default ignore files
    const ignoreFiles =
        (args.ignoreFiles as any) === false
            ? []
            : (args.ignoreFiles as any)?.split(";").filter((c: string) => !!c);
    if (ignoreFiles != null) {
        options.ignoreFiles = ignoreFiles;
    }

    if (args.updateTags != null) {
        options.autoFix = !!args.updateTags;
    }

    if (args.json != null) {
        options.json = !!args.json;
    }

    const comments = (args.comments as any)
        ?.split(" ")
        .filter((c: string) => !!c);
    if (comments != null) {
        options.comments = comments;
    }

    if (args.dryRun != null) {
        options.dryRun = !!args.dryRun;
    }

    if (args.rootMarker != null) {
        options.rootMarker = args.rootMarker as any;
    }

    if (args.allowEmptyTags != null) {
        options.allowEmptyTags = !!args.allowEmptyTags;
    }

    return options;
};
