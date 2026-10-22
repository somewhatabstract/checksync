/**
 * Get the path that mismatched output is written to for a golden file.
 *
 * The `.actual` marker goes before the extension so that the file keeps the
 * golden's type, e.g. `a.json` becomes `a.actual.json`.
 *
 * @param goldenPath The path of the golden file.
 * @returns The path for the actual output.
 */
export default function getActualPath(goldenPath: string): string {
    return goldenPath.replace(/(\.[^./\\]+)$/, ".actual$1");
}
