# checksync

[![Node CI](https://github.com/somewhatabstract/checksync/workflows/Node%20CI/badge.svg)](https://github.com/somewhatabstract/checksync/actions) [![codecov](https://codecov.io/gh/somewhatabstract/checksync/branch/master/graph/badge.svg)](https://codecov.io/gh/somewhatabstract/checksync)

## Installation

Package is not yet published.

## Usage

1. Add synchronization tags to files indicating what sections to synchronize and with which files:

    ```javascript
    // my-javascriptfile.js
    // sync-start:mysyncid ./my-pythonfile.py
    /**
     * Some code that needs to be synchronised.
     */
    // sync-end:mysyncid
    ```

    ```python
    # my-pythonfile.py
    # sync-start:mysyncid ./my-javascriptfile.js
    '''
    Some code that needs to be synchronised.
    '''
    # sync-end:mysyncid
    ```

1. Run `checksync` to verify the tags are correct:
    `yarn checksync <globs|files|dirs>`

1. Run with `--fix` to automatically insert the missing checksums:
    `yarn checksync --fix`

1. Add a pre-commit step to run `checksync` on commiting changes so that you catch when synchronized blocks change.
    You can do this using a package like husky, or pre-commit.

1. Commit your tagged files!

### Comment styles

By default, `checksync` supports comment lines that begin with `//` and `#` as commonly found in JavaScript and Python, among other languages. However, you can override this using the `--comments` argument.

## Development

Run `yarn install` to get all the dependencies installed.

Then run `./bin/checksync.dev.js __testdata__` to try the tool locally on some examples.

### Build

Run `yarn build` to build the distributable code. This can then be executed locally using `./bin/checksync.js`.

### Test

Run `yarn test` to execute unit tests, or `yarn coverage` to execute them with code coverage.

Run `yarn test:integration` to execute integration tests, or `yarn coverage:integration` to execute them with code coverage.

Run `yarn test:all` to execute all tests, or `yarn coverage:all` to execute all tests with code coverage.
