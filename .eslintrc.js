module.exports = {
    extends: ["@khanacademy"],
    plugins: ["eslint-comments", "import", "jest", "@babel"],
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
        "no-unused-vars": ["error", {args: "none", varsIgnorePattern: "^_*$"}],
        "no-var": "error",
        "one-var": ["error", "never"],
        "prefer-const": "error",
        "prefer-spread": "error",
        "require-await": "error",
        "require-yield": "error",

        // We turned this off because it complains when you have a
        // multi-line string, which I think is going too far.
        "prefer-template": "off",
        // We've decided explicitly not to care about this.
        "arrow-parens": "off",
        // ES6/jsx stuff that's disabled for now, but maybe shouldn't be.
        // TODO(csilvers): enable these if/when community agrees on it.
        "prefer-arrow-callback": "off",

        // Stuff that's disabled for now, but maybe shouldn't be.
        // TODO(jeresig): It's an anti-pattern but it appears to be used
        // frequently in reducers, the alternative would be super-clunky.
        "no-case-declarations": "off",
        // TODO(csilvers): enable these if/when community agrees on it.
        // Might be nice to turn this on one day, but since we don't
        // use jsdoc anywhere it seems silly to require it yet.
        "valid-jsdoc": "off",
        "require-jsdoc": "off",

        // eslint-comments
        "eslint-comments/no-unlimited-disable": "error",
        "eslint-comments/no-unused-disable": "error",

        // import
        "import/extensions": [
            "error",
            "never",
            {
                ignorePackages: true,
                pattern: {json: "always"},
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
        "import/default": "error",
        "import/namespace": "error",
        "import/no-unassigned-import": [
            "error",
            {
                allow: ["@jest/globals", "jest-extended"],
            },
        ],

        // jest
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/prefer-to-contain": "error",
        "jest/prefer-to-have-length": "error",
        "jest/valid-title": "error",

        // prettier
        "prettier/prettier": [
            "error",
            {
                tabWidth: 4,
                trailingComma: "all",
                bracketSpacing: false,
            },
        ],
    },
    overrides: [
        {
            files: ["*.test.ts"],
            rules: {
                "@typescript-eslint/no-empty-function": "off",
                "max-lines": "off",
            },
        },
    ],
    env: {
        es6: true,
        jest: true,
        node: true,
    },
};
