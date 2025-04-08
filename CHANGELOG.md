# checksync

## 10.0.0

### Major Changes

- 8c53b2c: Removed the `includeDotPaths` config option and associated argument. It was a mistake. If you need a path that starts with a `.` to be included, explicitly list it in the `includeGlobs` configuration or the paths passed to the CLI command.

## 9.0.1

### Patch Changes

- aa181d4: Fix --help

## 9.0.0

### Major Changes

- 4066145: Include dot paths when parsing include globs. This is a breaking change as this is turned on by default. To turn off, use the `--includeDotPaths=false` or explicitly set `includeDotPaths` in your config file.

### Minor Changes

- 38b0cbe: Fix bug with output sink and improve error messaging when root marker cannot be found

### Patch Changes

- c243766: Allow color output to be disabled using NO_COLOR=1 or FORCE_COLOR=0

## 8.0.1

### Patch Changes

- 2d2a9ad: Handle symlinks in a deterministic manner so that remote tag checksums are stable

## 8.0.0

### Major Changes

- 4b044fb: Add support for self-hashed tags with remote targets
- 2e87ab4: Add support for migrating any tag that matches a migration rule
- f8fd741: Add support for migrations and migrating tags that don't have return tags pointing to them

### Patch Changes

- 23439ea: Update to TypeScript 5.7.3
- f8fd741: Add support for iterator helpers per the proposal
- ecd9da4: Moving to pnpm instead of yarn
- e2f8b09: Add ability to parse markers to a JSON file and then use that file as input to future runs
- d784980: Rework error generation to make code a little more manageable

## 7.0.1

### Patch Changes

- 2d2d6a4: Fix --help and --version

## 7.0.0

### Major Changes

- 6ed7f08: This fixes an issue where default argument values would override explicit configuration. This was unintentional; only explicitly provided argument values should override configuration. Since some folks may be relying on this broken behaviour, this is a major update. As part of this fix, argument parsing is now handled by yargs instead of minimist

## 6.0.2

### Patch Changes

- e20347a: Fix --allowEmptyTags arg and update help.

## 6.0.1

### Patch Changes

- e996820: Add support for empty tags. This is a non-breaking change. The configuration must be updated to allow this.

## 6.0.0

### Major Changes

- 3b4b35d: - Node 20 or higher required. Support for Node 16 and Node 18 is deprecated.

    - Eslint updated to version 9. For maintainers of this repo, this means some rules aren't working properly as they don't yet support the new flat configuration format of Eslint 9. See the configuration file for details.
    - Babel, jest, typescript, and various other dependencies have been updated to their latest versions.
    - Security vulnerabilities have been addressed with resolutions (https://github.com/somewhatabstract/checksync/security/dependabot/17, https://github.com/somewhatabstract/checksync/security/dependabot/18)

## 5.0.5

### Patch Changes

- 5273520: Update dependencies

## 5.0.4

### Patch Changes

- c7e3562: Fix engines

## 5.0.3

### Patch Changes

- 003a91a: Fix rollup config to bundle deps

## 5.0.2

### Patch Changes

- 7654f97: Add publishConfig

## 5.0.1

### Patch Changes

- 52ddefd: Updating some things to get automated changeset release working

## 5.0.0

### Major Changes

- 6b561be: Migrate to TypeScript

    Although there are no functional changes here, we are bumping the major version since changing our static types are provided from Flow to TypeScript could break some folks development setups.

- 14bbc5f: Working directory updates
    - The location of the configuration file is now used as the current working directory, if a configuration file is used. This means that globs are resolved relative to the configuration file, not the current working directory of the process launching checksync, which makes for a more deterministic behavior for
      folks trying to define and use their config files.
    - A `--cwd` argument has been added for specifying the working directory in cases where a configuration file is not used, or the configuration file discover needs to start in a place other than where checksync is invoked. If a configuration file is loaded, the location of that file takes precedence.
- 95d1a29: Update gitignore support to support full range of syntax. We now use the [`ignore`](https://www.npmjs.com/package/ignore) package to support the gitignore file syntax. New verbose logging has been added to help debug ignore file issues, too.

### Patch Changes

- 9534465: Improved console output to make things easier to read/scan
