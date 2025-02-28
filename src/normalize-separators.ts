import path from "path";
import escapeRegExp from "lodash/escapeRegExp";

/**
 * Normalize separators to forward slashes.
 */
const normalizeSeparators = (g: string): string =>
    g.replace(new RegExp(escapeRegExp(path.sep), "g"), "/");

/**
 * Normalize separators to the OS default.
 */
export const osSeparators = (g: string): string => g.replace(/\//g, path.sep);

export default normalizeSeparators;
