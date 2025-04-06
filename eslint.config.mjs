import eslintComments from "eslint-plugin-eslint-comments";
import _import from "eslint-plugin-import";
import jest from "eslint-plugin-jest";
import babel from "@babel/eslint-plugin";
import {fixupPluginRules} from "@eslint/compat";
import globals from "globals";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: [
            "**/node_modules",
            "flow-typed/**/*.js",
            "**/coverage",
            "**/dist",
            "**/__examples__/**",
            ".prettierrc.js",
        ],
    },
    ...compat.extends("@khanacademy"),
    {
        plugins: {
            "eslint-comments": eslintComments,
            import: fixupPluginRules(_import),
            jest,
            "@babel": babel,
        },

        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node,
            },
        },
    },
    {
        files: [
            "**/src/**",
            "**/bin/**",
            "**/__tests__/**/*.ts",
            "**/__mocks__/**/*.ts",
        ],

        rules: {
            "constructor-super": "error",
            curly: "error",
            eqeqeq: ["error", "allow-null"],
            "guard-for-in": "error",
            "linebreak-style": ["error", "unix"],
            "no-alert": "error",
            "no-array-constructor": "error",
            "no-console": "error",
            "no-debugger": "error",
            "no-dupe-class-members": "error",
            "no-dupe-keys": "error",
            "no-extra-bind": "error",
            "no-new": "error",
            "no-new-func": "error",
            "no-new-object": "error",
            "no-throw-literal": "error",
            "@babel/no-invalid-this": "error",
            "no-with": "error",
            "no-async-promise-executor": "error",
            "no-const-assign": "error",

            "no-else-return": [
                "error",
                {
                    allowElseIf: false,
                },
            ],

            "no-irregular-whitespace": "off",
            "no-multi-str": "error",
            "no-prototype-builtins": "off",
            "no-return-await": "error",
            "no-this-before-super": "error",
            "no-useless-catch": "off",
            "no-useless-call": "error",
            "no-undef": "error",
            "no-unexpected-multiline": "error",
            "no-unreachable": "error",
            "no-unused-expressions": "error",
            "no-var": "error",
            "one-var": ["error", "never"],
            "prefer-const": "error",
            "prefer-spread": "error",
            "require-await": "error",
            "require-yield": "error",
            "prefer-template": "off",
            "arrow-parens": "off",
            "prefer-arrow-callback": "off",
            "no-case-declarations": "off",
            "valid-jsdoc": "off",
            "require-jsdoc": "off",
            "eslint-comments/no-unlimited-disable": "error",
            "eslint-comments/no-unused-disable": "error",

            "import/extensions": [
                "error",
                "never",
                {
                    ignorePackages: true,

                    pattern: {
                        json: "always",
                    },
                },
            ],

            "import/no-cycle": [
                "error",
                {
                    ignoreExternal: true,
                    commonjs: true,
                    maxDepth: 6,
                },
            ],

            "import/named": "error",

            // NOTE(2024-06-14): These two rules have to be turned off for now
            // as they don't work with the new flat config file that ESLint 9
            // requires.
            // https://github.com/import-js/eslint-plugin-import/issues/2556
            "import/default": "off",
            "import/namespace": "off",

            "import/no-unassigned-import": [
                "error",
                {
                    allow: ["@jest/globals", "jest-extended"],
                },
            ],

            "jest/no-focused-tests": "error",
            "jest/no-identical-title": "error",
            "jest/prefer-to-contain": "error",
            "jest/prefer-to-have-length": "error",
            "jest/valid-title": "error",

            "prettier/prettier": [
                "error",
                {
                    tabWidth: 4,
                    trailingComma: "all",
                    bracketSpacing: false,
                },
            ],
        },
    },
    {
        files: ["**/*.test.ts"],

        rules: {
            "@typescript-eslint/no-empty-function": "off",
            "max-lines": "off",
        },
    },

    {
        files: ["**/bin/**"],

        rules: {
            "import/extensions": "off",
            "@typescript-eslint/no-require-imports": "off",
        },
    },
];
