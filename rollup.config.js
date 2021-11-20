import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";

import filesize from "rollup-plugin-filesize";
import {terser} from "rollup-plugin-terser";

export default {
    input: "./src/main.js",
    output: {
        file: "./dist/main.js",
        format: "cjs",
        sourcemap: true,
        exports: "auto",
    },
    plugins: [
        json(),
        resolve({preferBuiltins: true}),
        babel({
            babelHelpers: "bundled",
            exclude: "node_modules/**", // only transpile our source code
        }),
        commonjs({
            sourceMap: false,
        }),
        terser(),
        filesize(),
    ],
};
