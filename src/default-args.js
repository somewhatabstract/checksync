// @flow
const defaultArgs = {
    updateTags: false,
    comments: `${["#,//"].sort().join(",")}`,
    ignore: "",
    help: false,
    dryRun: false,
    ignoreFiles: ".gitignore",
    noIgnoreFile: false,
    json: false,
    silent: false,
};

export default defaultArgs;
