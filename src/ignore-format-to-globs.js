// @flow
import path from "path";
import normalizeSeparators from "./normalize-separators.js";

/**
 * Following gitignore format https://git-scm.com/docs/gitignore#_pattern_format
 * NOTE: Using `\` instead of `/` in the outcome examples to dodge an issue
 *       with flow parsing and **[forward slash].
 *
 * /foo  Only root (not sub) file and dir and its paths underneath.         `\foo`, `\foo\**`
 * /foo/ Only root (not sub) foo dir and its paths underneath.              `\foo\**`
 * foo   Both root and sub foo files and dirs and their paths underneath.   `foo`, `**\foo\**`
 * foo/  Both root and sub foo dirs and their paths underneath.	            `**\foo\**`
 */
export default function* ignoreFormatToGlobs(
    ignores: Array<string>,
): Iterator<string> {
    for (const ignore of ignores) {
        if (ignore.startsWith("/")) {
            yield normalizeSeparators(path.join(ignore, "**"));
            if (!ignore.endsWith("/")) {
                yield ignore;
            }
        } else {
            yield normalizeSeparators(path.join("**", ignore, "**"));
            if (!ignore.endsWith("/")) {
                yield ignore;
            }
        }
    }
}
