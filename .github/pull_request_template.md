<!--
Thanks for contributing! The PR title must be a Conventional Commit
(e.g. `feat: add JWT decoder`, `fix(dns): handle empty TXT records`).
PRs are squash-merged and the title drives the release version and changelog.
See CONTRIBUTING.md for details.
-->

## What & why

<!-- What does this change, and why? Link related issues with "Closes #123". -->

## How it was tested

<!-- Commands you ran, inputs you tried, edge cases checked. -->

## Screenshots

<!-- For UI changes: before/after, light and dark. Delete this section otherwise. -->

## Checklist

- [ ] PR title is a [Conventional Commit](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `feat!:` for breaking changes)
- [ ] `bun run check` passes (type-check, Biome lint + format, tests)
- [ ] Tests added or updated for new or changed logic
- [ ] New or changed tools follow the [tool guidelines](https://github.com/good-tools/good.tools/blob/master/CONTRIBUTING.md#tool-guidelines): dense layout, works in light + dark, inputs labelled, state kept with `useToolState`
- [ ] Online tools are marked `online: true`, and no user input is stored or sent anywhere it doesn't need to go
