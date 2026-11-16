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

- Each public function lives in its own module file, named after the function
  (e.g. `calc_checksum.rs` for `calc_checksum`).
- Shared types live in the nearest `types.rs`: a submodule's own (such as
  `glob/types.rs`) for types only it uses, otherwise the crate's.
- A submodule that could become its own crate (such as `glob` or
  `gitignore`) refers to its own files with `super::`, uses other modules
  only through what they expose, and exposes only what code outside it uses.
- Unit tests live in a `#[cfg(test)] mod tests` block at the bottom of the
  module they test.

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
