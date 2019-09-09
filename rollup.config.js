import resolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import minify from "rollup-plugin-babel-minify";
import analyzer from "rollup-plugin-analyzer";

export default {
    input: "./lib/cli.js",
    output: {
        file: "./dist/cli.js",
        format: "cjs",
    },
    plugins: [
        resolve({preferBuiltins: true}),
        babel({
            exclude: "node_modules/**", // only transpile our source code
        }),
        commonjs({
            namedExports: {"promise.prototype.finally": ["shim"]},
        }),
        minify(),
        analyzer({summaryOnly: true, filter: module => module.size !== 0}),
    ],
};
