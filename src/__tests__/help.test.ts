import logHelp from "../help";
import StringLogger from "../string-logger";

describe("#logHelp", () => {
    it("should log the help as expected", () => {
        // Arrange
        const logger = new StringLogger();

        // Act
        logHelp(logger);

        // Assert
        expect(logger.getLog()).toMatchInlineSnapshot(`
            "checksync 4.0.0 ✅ 🔗

            Checksync uses tags in your files to identify blocks that need to remain
            synchronised. It works on any text file as long as it can find the tags.

            Tag Format

            Each tagged block is identified by one or more sync-start tags and a single
            sync-end tag.

            The sync-start tags take the form:

                <comment> sync-start:<marker_id> <?checksum> <target_file>

            The sync-end tags take the form:

                <comment> sync-end:<marker_id>

            Each marker_id can have multiple sync-start tags, each with a different
            target file, but there must be only one corresponding sync-end tag.

            Where:

                <comment>       is one of the comment tokens provided by the --comment
                                argument

                <marker_id>     is the unique identifier for this marker

                <checksum>      is the expected checksum of the corresponding block in
                                the target file

                <target_file>   is the path from your package root to the target file
                                with a corresponding sync block with the same marker_id

            Usage

            checksync <arguments> <include_paths>

            Where:

                <arguments>        are the arguments you provide (see below).

                <include_paths>    are space-separated paths and glob patterns
                                   for identifying files to check.
                                   Defaults to all files below the current working
                                   directory.

            Arguments

                --comments,-c      A string containing space-separated tokens that
                                   indicate the start of lines where tags appear.
                                   Defaults to "// #".

                --config           Path to a JSON file containing configuration options.
                                   When not specified, checksync will look for a config
                                   file; use --no-config to disable this search.

                                   The search starts relative to the current working
                                   directory, first by looking adjacent to a marker file
                                   match, otherwise, by looking for a configuration file in
                                   or above the current working directory. Filenames that
                                   are considered:
                                       .checksyncrc
                                       .checksyncrc.json

                --dry-run,-n       Ignored unless supplied with --update-tags.

                --help,-h          Outputs this help text.

                --ignore,-i        A string containing semi-colon-separated globs that
                                   identify files that should not be checked.

                --ignore-files     A semi-colon-separated list of paths and globs that
                                   identify .gitignore-format files defining patterns for
                                   paths to be ignored. These will be combined with the
                                   explicit --ignore globs.
                                   Ignored if --no-ignore-file is present.
                                   Defaults to .gitignore.

                --json,-j          Output errors and violations as JSON.

                --no-config        Prevents searching for a configuration file.
                                   Ignored if --config is supplied.

                --no-ignore-files  When true, does not use any ignore file. This is
                                   useful when the default value for --ignore-file is
                                   not wanted.

                --root-marker,-m   By default, the root directory (used to generate
                                   interpret and generate target paths for sync-start
                                   tags) for your project is determined by the nearest
                                   ancestor directory to the processed files that
                                   contains a package.json file. If you want to
                                   use a different file or directory to identify your
                                   root directory, specify that using this argument.
                                   For example, --root-marker .gitignore would mean
                                   the first ancestor directory containing a
                                   .gitignore file.

                --update-tags,-u   Updates tags with incorrect target checksums. This
                                   modifies files in place; run with --dry-run to see
                                   what files will change without modifying them.

                --verbose          More details will be added to the output when this
                                   option is provided. This is useful when determining if
                                   provided glob patterns are applying as expected, for
                                   example.

                --version          Outputs the version and exits.

            Configuration Format
            A configuration file is a JSON file containing configuration options. All
            of the values are optional (defaults apply per the corresponding CLI arguments).
            Arguments supplied along with a configuration file will override the
            configuration file.

                autoFix             Equivalent to using the --update-tags option.

                dryRun              Equivalent to using the --dry-run option.

                comments            Equivalent to using the --comments option,
                                    except an array instead of space-separated string.

                ignoreFiles         Equivalent to using the --ignore-files option,
                                    except an array instead of semi-colon-separated string.
                                    An empty array is equivalent to --no-ignore-files.

                excludeGlobs        Equivalent to using the --ignore option, except
                                    an array instead of semi-colon-separated string.

                includeGlobs        Equivalent to the include_paths passed at the
                                    end of the command line.

                rootMarker          Equivalent to using the --root-marker option.

            Example:
                {
                    "autoFix": true,
                    "dryRun": false,
                    "comments": ["//", "#"],
                    "ignoreFiles": [".gitignore"],
                    "includeGlobs": ["**/*.js"],
                    "excludeGlobs": ["**/node_modules/**"],
                    "rootMarker": ".gitignore",
                    "json": false
                }"
        `);
    });
});
