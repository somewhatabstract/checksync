# checksync

[![Node CI](https://github.com/somewhatabstract/checksync/actions/workflows/nodejs.yml/badge.svg?branch=main)](https://github.com/somewhatabstract/checksync/actions/workflows/nodejs.yml) [![codecov](https://codecov.io/gh/somewhatabstract/checksync/branch/main/graph/badge.svg)](https://codecov.io/gh/somewhatabstract/checksync) [![npm (tag)](https://img.shields.io/npm/v/checksync/latest)](https://www.npmjs.com/package/checksync) [![Required Node Version](https://img.shields.io/node/v/checksync/latest)](https://www.npmjs.com/package/checksync)

## Usage

You can install `checksync` if you want, but the easiest way to use it is via `npx`.

```shell
npx checksync --help
```

For detailed usage information, run `npx checksync --help`.

### Example workflow

1. Add synchronization tags to files indicating what sections to synchronize and with which files or URLs:

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

    You can also target remote tags by using a URL as the target. Remote targets
    are self-hashed: `checksync` verifies the checksum against the local tagged
    block, but does not fetch or parse the remote URL.

    ```jsx
    {/* sync-start:mysyncid https://github.com/example/repo/blob/main/example.jsx#L10 */}
    <span>Some code that needs to be synchronised.</span>
    {/* sync-end:mysyncid */}
    ```

1. Run `checksync` to verify the tags are correct:

    ```shell
    pnpm checksync <globs|files|dirs>
    ```

1. Run with `--update-tags` or `-u` to automatically insert the missing checksums:

    ```shell
    pnpm checksync -u <globs|files|dirs>
    ```

1. Add a pre-commit step to run `checksync` on committing changes so that you catch when synchronized blocks change.
    You can do this using a package like husky, or pre-commit.

1. Commit your tagged files!

To get more information about the various arguments that `checksync` supports as well as information about sync-tags, run `pnpm checksync --help`.

### Target file paths

Local target paths are relative to your project root directory. By default, this is determined, using `ancesdir` to be the ancestor directory of the files being processed that contains `package.json`. If you want to specify a different root (for example, if you're syncing across multiple packages in a monorepo) you can specify a custom marker name using the `--root-marker` argument.

Remote targets are any targets that contain `://`. They are stored as-is, so a
tag can point to a permalink, source browser URL, documentation page, or another
repository.

### Features worth knowing

- `checksync` supports configuration files named `.checksyncrc` or `.checksyncrc.json`. Configuration file paths and globs are resolved relative to the configuration file location.
- `includeGlobs`, `excludeGlobs`, `--ignore`, and `--ignore-files` let you control exactly which files are parsed. `.gitignore` is used by default.
- `--comments` lets you configure comment tokens for languages beyond the defaults of `#`, `//`, and `{/*`.
- `--update-tags --dry-run` reports which files would be changed without writing fixes.
- `--json` emits machine-readable errors and violations for tooling.
- `--output-cache` and `--use-cache` let you parse once and process from a saved cache, which is useful in CI workflows that separate file discovery from reporting.
- Empty tagged blocks are rejected by default, but can be allowed with `--allow-empty-tags` or `allowEmptyTags`.
- Migration rules can rewrite local tag targets to new targets, including remote URLs. Use the `migration` configuration with `--migrate missing` to migrate missing local targets, or `--migrate all` to migrate every matching target.

## Contributing

For details on contributing to `checksync`, checkout our [contribution guidelines](CONTRIBUTING.md).
