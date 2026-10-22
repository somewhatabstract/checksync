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
- Shared types live in the crate's `types.rs`.
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
