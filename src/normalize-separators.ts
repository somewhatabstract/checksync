import path from "path";
import escapeRegExp from "lodash/escapeRegExp";

/**
 * Normalize separators to forward slashes.
 */
const normalizeSeparators = (g: string): string =>
    g.replace(new RegExp(escapeRegExp(path.sep), "g"), "/");

export default normalizeSeparators;
