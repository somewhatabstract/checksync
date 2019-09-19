// @flow
import Format from "./format.js";
import type {ILog} from "./types.js";

const helpMarkDown = `# checksync ✅ 🔗

Checksync uses tags in your files to identify blocks that need to remain
synchronised. It works on any text file as long as it can find the tags.

## Tag Format

Each tagged block is identified by one or more sync-start tags and a single
sync-end tag.

The sync-start tags take the form:

    \`<comment> sync-start:<marker_id> <?checksum> <target_file>\`

The sync-end tags take the form:

    \`<comment> sync-end:<marker_id>\`

Where:

    \`<comment>\`     is one of the comment tokens provided by the \`--comment\`
                    argument

    \`<marker_id>\`   is the unique identifier for this marker

    \`<checksum>\`    is the expected checksum of the corresponding block in
                    the target file

    \`<target_file>\` is the path from your package root to the target file
                    with a corresponding sync block with the same \`marker_id\`

## Usage

\`checksync <arguments> <include_globs>\`

Where:

    \`<arguments>\`     are the arguments you provide (see below)

    \`<include_globs>\` are glob patterns for identifying files to check

## Arguments

    \`--comments,-c\`    A string containing comma-separated tokens that
                       indicate the start of lines where tags appear.
                       Defaults to \`"//,#"\`

    \`--dry-run,-n\`     Ignored unless supplied with \`--update-tags\`

    \`--help,-h\`        Outputs this help text

    \`--ignore,-i\`      A string containing comma-separated globs that identify
                       files that should not be checked

    \`--root-marker,-m\` By default, the root directory (used to generate
                       interpret and generate target paths for sync-start
                       tags) for your project is determined by the nearest
                       ancestor directory to the processed files that
                       contains a \`package.json\` file. If you want to
                       use a different file or directory to identify your
                       root directory, specify that using this argument.
                       For example, \`--root-marker .gitignore\` would mean
                       the first ancestor directory containing a
                       \`.gitignore\` file.

    \`--update-tags,-u\` Updates tags with incorrect target checksums. This
                       modifies files in place; run with \`--dry-run\` to see what
                       files will change without modifying them.
`;

export default function logHelp(log: ILog) {
    const regexHeaders = new RegExp(/#+\s+([^\n]*)/gi);
    const regexCode = new RegExp(/(\s*)`([^`]*)`/gi);

    // Parse text from markdown into formatted text.
    const formattedHelp = helpMarkDown
        .replace(regexHeaders, (s, ...args) => {
            const [heading] = args;
            return Format.heading(`${heading}`);
        })
        .replace(regexCode, (s, ...args) => {
            const [space, code] = args;
            return `${space}${Format.code(code)}  `;
        });

    log.log(formattedHelp);
}
