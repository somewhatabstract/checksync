// @flow
const defaultArgs = {
    updateTags: false,
    json: false,
    comments: `${["#", "//", "{/*"].sort().join(" ")}`,
    ignore: "",
    help: false,
    dryRun: false,
    ignoreFiles: ".gitignore",
    noIgnoreFile: false,
};

export default defaultArgs;
