// @flow
const defaultArgs = {
    updateTags: false,
    comments: `${["#,//"].sort().join(",")}`,
    ignore: "",
    help: false,
    dryRun: false,
    ignoreFiles: ".gitignore",
    noIgnoreFile: false,
};

export default defaultArgs;
