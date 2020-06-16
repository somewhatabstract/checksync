// This is a a javascript (or similar language) file

// sync-start:correct 249234014 __examples__/correct_checksums/b.py
const someCode = "does a thing";
console.log(someCode);
// sync-end:correct

// sync-start:correct2 279463297 __examples__/correct_checksums/b.py
// sync-start:correct2 1992689801 __examples__/correct_checksums/c.jsx
const outputDir = path.join(rootDir, "genwebpack/khan-apollo");

// Handle auto-building the GraphQL Schemas + Fragment Types
module.exports = new FileWatcherPlugin({
    name: "GraphQL Schema Files",

    // The location of the Python files that are used to generate the
    // schema
    filesToWatch: [
        path.join(rootDir, "*/graphql/**/*.py"),
        path.join(rootDir, "*/*/graphql/**/*.py"),
    ],
// sync-end:correct2
