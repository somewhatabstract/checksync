# checksync

[![Node CI](https://github.com/somewhatabstract/checksync/workflows/Node%20CI/badge.svg)](https://github.com/somewhatabstract/checksync/actions) [![codecov](https://codecov.io/gh/somewhatabstract/checksync/branch/master/graph/badge.svg)](https://codecov.io/gh/somewhatabstract/checksync)

## Installation

Install using your preferred package manager.

```shell
yarn add --dev checksync
```

```shell
npm install --save-dev checksync
```

After installation, try running `checksync` with the `--help` argument to see more information:

```shell
yarn checksync --help
```

```shell
npx checksync --help
```

## Usage

For detailed usage information, run `yarn checksync --help`.

### Example workflow

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

    Use consecutive `sync-start` tags with the same identifier to target multiple files.

    ```c#
    // my-csharpfile.cs
    // sync-start:mysyncid ./my-pythonfile.py
    // sync-start:mysyncid ./my-javascriptfile.js
    /**
     * Some code that needs to be synchronised.
     */
    // sync-end:mysyncid
    ```

1. Run `checksync` to verify the tags are correct:

    ```shell
    yarn checksync <globs|files|dirs>
    ```

1. Run with `--update-tags` or `-u` to automatically insert the missing checksums:

    ```shell
    yarn checksync -u <globs|files|dirs>
    ```

1. Add a pre-commit step to run `checksync` on commiting changes so that you catch when synchronized blocks change.
    You can do this using a package like husky, or pre-commit.

1. Commit your tagged files!

To get more information about the various arguments that `checksync` supports as well as information about sync-tags, run `yarn checksync --help`.

### Target file paths

All target paths are relative to your project root directory. By default, this is determined, using `ancesdir` to be the ancestor directory of the files being processed that contains `package.json`. If you want to specify a different root (for example, if you're syncing across multiple packages in a monorepo) you can specify a custom marker name using the `--root-marker` argument.

### Comment styles

By default, `checksync` supports comment lines that begin with `//` and `#` as commonly found in JavaScript, Python, and other languages. You can override this default using the `--comments` or `-c` argument.

```shell
yarn checksync -c="//,#,'" <globs|files|dirs>
```

### Ignoring files

`checksync` supports both a comma-separated list of globs (via `--ignore`) and a comma-separated list of `.gitignore` style files (via `--ignore-files`) to control what files are ignored. By default, the `.gitignore` file is used unless the `--no-ignore-file` argument is used.

## Contributing

For details on contributing to `checksync`, checkout our [contribution guidelines](CONTRIBUTING.md).
