# checksync (Rust)

A Rust implementation of checksync, in progress. See
[#2524](https://github.com/somewhatabstract/checksync/issues/2524) for the plan.
Nothing here ships in the npm package yet.

## Layout

- `checksync-core`: the library. Checksums, parsing, and sync verification. It
  does no network access and never prints; it returns data.
- `checksync-cli`: the `checksync` binary. Argument parsing, output formatting,
  and exit codes, built on `checksync-core`.

## Conventions

The code follows the Rust community's conventions: the standard library, RFC
1574 and the Rust API Guidelines.

- **Doc comments:** a one-line summary in the third person ("Returns the …"),
  then prose. There are no `# Arguments` or `# Returns` sections. Use
  `# Errors` on anything returning `Result`, `# Panics` on anything that can
  panic on purpose, and intra-doc links (`` [`GlobOptions`] ``) to other items.
- **Modules:** a file is a module grouped by concern: one main type or
  function plus its private helpers, or a few closely related items. A helper
  with one caller stays private in that caller's file and is tested there.
  Aim for files under about 400 lines including tests, and split one that
  passes about 600 lines or covers two concerns. A module with submodules
  uses `foo.rs` plus `foo/`, not `foo/mod.rs`.
- **Types:** a type lives in the module that owns its behaviour, with its
  `impl` blocks. An operation that mainly works on one type is a method on
  it, and a constructor is `new` or `try_new`. A `types.rs` holds only data
  types several sibling modules share with no single owner.
- **Visibility:** each item gets the narrowest visibility its users need. A
  submodule that could become its own crate (such as `glob` or `gitignore`)
  uses other modules only through what they expose, and exposes only what
  code outside it uses.
- **Tests:** unit tests live in a `#[cfg(test)] mod tests` block at the
  bottom of the module they test, and can test its private items. Tests of
  the public API, such as the shared conformance vectors, live in `tests/`.
  Each test has Arrange, Act and Assert sections and one expectation.
- **Unsafe code** is forbidden in the workspace's lint settings.

## Commands

Run these from this directory. The toolchain version is pinned in
`rust-toolchain.toml`, and `rustup` installs it on first use.

| Task | Command |
|---|---|
| Build | `cargo build` |
| Test | `cargo test` |
| Format | `cargo fmt` |
| Lint | `cargo clippy --all-targets -- -D warnings` |
| Run | `cargo run -- <args>` |
