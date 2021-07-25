// @flow
import ignoreFileToExcludeGlobs from "./ignore-file-to-exclude-globs.js";

export default async (
    ignoreFiles: $ReadOnlyArray<string>,
): Promise<$ReadOnlyArray<string>> => {
    // Load the files as the globs they describe.
    const ignoresByFile = await Promise.all(
        ignoreFiles.map((file) => ignoreFileToExcludeGlobs(file)),
    );

    // Flatten our array of arrays into a single array.
    const allIgnores = ignoresByFile.reduce(
        (prev, current) => [...prev, ...current],
        [],
    );

    // Remove duplicates (though there shouldn't be any).
    return Array.from(new Set(allIgnores));
};
