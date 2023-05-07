import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";

import filesize from "rollup-plugin-filesize";
import {terser} from "rollup-plugin-terser";
import copy from "rollup-plugin-copy";

export default {
    input: "./src/main.ts",
    output: {
        dir: "./dist",
        format: "cjs",
        sourcemap: true,
        exports: "auto",
    },
    plugins: [
        json(),
        resolve({preferBuiltins: true, extensions: [".ts"]}),
        babel({
            configFile: "./babel.config.js",
            extensions: [".ts"],
            babelHelpers: "bundled",
            exclude: "node_modules/**", // only transpile our source code
        }),
        commonjs({
            sourceMap: false,
        }),
        terser(),
        filesize(),
        copy({
            targets: [
                {
                    src: "./src/checksync.schema.json",
                    dest: "./dist",
                },
            ],
        }),
    ],
};
