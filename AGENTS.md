# Agent guidelines

## Independent review

This repository has no automated code review, so an independent reviewer
looks at changes before they're handed to a maintainer.

- **When:** review every new pull request, and any later change to one that
  would clearly benefit from a fresh look, such as a logic change or a bug
  fix.
- **When not:** skip straight merges, such as bringing a base or stacked
  branch up to date, and trivial edits, such as rewording or adding tests.
- **Who:** the reviewer is separate from the agent that wrote the change, such
  as a fresh subagent or session running a code-review tool. Give it the diff
  and the goal, not the author's reasoning or conclusions, so its read isn't
  anchored on them.
- **What to point it at:** an exact branch or commit range. A bare pull
  request number can resolve to a different repository.
- **Where it works:** in its own git worktree, and for Rust with its own build
  folder (set `CARGO_TARGET_DIR`). Otherwise concurrent builds overwrite each
  other's test binaries.
- **What it does with findings:** it reports them back rather than posting to
  the pull request or changing files. The author verifies each finding before
  acting on it.

Remove this section if the repository gets automated review.
