// @flow
const defaultArgs = {
    updateTags: false,
    comments: `${["#,//"].sort().join(",")}`,
    ignore: "",
    help: false,
    dryRun: false,
    ignoreFile: ".gitignore",
};

export default defaultArgs;
