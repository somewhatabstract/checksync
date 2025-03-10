import {Options} from "./types";
import {Arguments} from "yargs";

/**
 * Convert arguments to options.
 */
export const optionsFromArgs = (args: Arguments<any>): Partial<Options> => {
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

    if (args.outputCache != null) {
        // Only overwrite the path if one was given, otherwise we'll let
        // defaults handle that.
        if (args.outputCache) {
            options.cachePath = args.outputCache;
        }
        options.cacheMode = "write";
    }

    if (args.fromCache != null) {
        // Only overwrite the path if one was given, otherwise we'll let
        // defaults handle that.
        if (args.fromCache) {
            options.cachePath = args.fromCache;
        }
        options.cacheMode = "read";
    }

    if (args.migrate != null) {
        options.migration = {
            mode: args.migrate,
            mappings: {},
        };
    }

    return options;
};
