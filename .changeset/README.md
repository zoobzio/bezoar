# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): one
Markdown file per change, declaring the semver bump and the release note.

Add one with `pnpm changeset` and commit it alongside your PR. Releases are
manual: the release workflow applies the pending changesets, commits the bump,
and publishes.

Versioning is **fixed** — every published package of the workspace shares one
version and releases together, so a changeset for any of them bumps them all.
List each published package in the `fixed` group of `config.json` as it is
added, and each example in `ignore`. The groups are empty until the first
package lands: changesets refuses a name that matches no package.
