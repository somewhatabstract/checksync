import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";

import filesize from "rollup-plugin-filesize";
import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";
import {codecovRollupPlugin} from "@codecov/rollup-plugin";

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
        resolve({
            preferBuiltins: true,
            extensions: [".ts", ".mjs", ".js", ".json", ".node"],
        }),
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
        copy({
            targets: [
                {
                    src: "./src/checksync.schema.json",
                    dest: "./dist",
                },
            ],
        }),
        process.env.CODECOV_TOKEN == null
            ? // This plugin outputs size info to the console when local.
              filesize()
            : // This plugin provides bundle analysis from codecov, but does
              // not work locally without additional config, and it does not
              // output size info to the console.
              codecovRollupPlugin({
                  enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
                  bundleName: "checksync",
                  uploadToken: process.env.CODECOV_TOKEN,
              }),
    ],
};
