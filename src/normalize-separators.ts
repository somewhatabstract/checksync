import path from "path";

/**
 * Normalize separators to forward slashes.
 *
 * This is used for testing.
 */
const normalizeSeparators = (g: string): string => g.split(path.sep).join("/");

export default normalizeSeparators;
