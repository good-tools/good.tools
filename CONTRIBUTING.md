# Contributing to good.tools

Thanks for helping out! Bug reports, tool ideas and pull requests are all welcome.

- **Bugs and ideas:** [open an issue](https://github.com/good-tools/good.tools/issues/new). For bugs, include the tool, what you pasted or loaded (if you can share it), and what you expected.
- **Code:** fork, branch, and open a pull request against `master`.

## Setup

You need [Bun](https://bun.sh) ≥ 1.2.

```bash
bun install
bun run dev        # http://localhost:3000
```

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `bun run dev`          | Dev server with hot reload                             |
| `bun run check`        | Type-check, lint + format check (Biome) and tests (CI runs this) |
| `bun run format`       | Format, organise imports and apply safe lint fixes (Biome) |
| `bun run lint`         | Lint only                                              |
| `bun run test:watch`   | Vitest in watch mode                                   |
| `bun run build`        | Sitemap, type-check and production build into `dist/`  |
| `bun run preview`      | Serve the production build                             |

[Biome](https://biomejs.dev) does linting and formatting in one fast pass; its configuration is in `biome.json`. Install the Biome editor extension and turn on format-on-save, and you'll rarely think about it. If a rule is wrong for a specific line, suppress it with `// biome-ignore <rule>: <reason>`. The reason is required.

Online tools (DNS, WHOIS, IP, Docker Browser) call `https://internet-tools.fly.dev` and `https://image-browser.fly.dev` in dev. See `.env.example` to point them elsewhere.

## Project layout

```
src/
  config/tools.config.ts   # the tool registry: the single list of every tool
  tools/                   # one component per tool (lazy-loaded)
  workers/                 # web workers (Wireshark, libvips, mesh repair)
  components/ui/           # design system: Workspace, Split, Panel, Button, Input, Alert, …
  components/shell/        # header, sidebar, command palette
  hooks/                   # useToolState, API hooks
  pages/                   # home, tool page wrapper, 404
```

## Adding a tool

1. **Create `src/tools/MyTool.tsx`** with a default-exported component. `src/tools/Base64.tsx` is the reference implementation.
2. **Register it** in `src/config/tools.config.ts`:

   ```ts
   {
     title: 'My Tool',
     path: '/my-tool',
     description: 'One sentence about what it does',
     icon: Wrench, // from lucide-react
     categories: [CATEGORIES.DEVELOPMENT],
     searchTags: ['keywords', 'for', 'search'],
     component: lazy(() => import('@/tools/MyTool')),
     online: false, // true if it sends data to a server
   }
   ```

   The route, the sidebar entry, search, the home page listing and `sitemap.xml` all come from this entry.

3. **Add tests** for any parsing or transformation logic (`*.test.ts(x)` next to the file).

### Tool guidelines

- **Focus on the tool.** The page already renders the title bar (name, description, local/online badge). Start straight with the tool UI.
- **Layout.** Use `Workspace` (a toolbar plus a full-height body) with a `Split` of input and output `Panel`s from `@/components/ui/toolbar`. Toolbar buttons are `size='sm'`. The main action is `variant='default'`; secondary actions such as _Load file_ and _Load example_ are `variant='ghost'` with an icon.
- **Live output.** Show results as the user types when computing them is cheap and has no side effects; keep an explicit button for expensive work.
- **Errors.** Show them in an `<Alert>`, never only in the console. Use `<Spinner>` for loading and give every output a `<CopyButton>`.
- **State.** Use `useToolState('mytool:field', initial)` instead of `useState` for anything the user typed or produced, so it survives navigating between tools. It's in-memory only: never persist tool input to `localStorage` or send it anywhere it doesn't need to go.
- **Design.** It's dense and monochrome. Use the theme tokens (`bg-background`, `text-muted-foreground`, `border`, …), not palette colours. Colour is reserved for status (`success`, `warning`, `destructive`), and it must look right in both light and dark mode.
- **Accessibility.** Every input needs a label (`<Label htmlFor>` or `aria-label`), and anything clickable must be a real `<button>` or `<a>`.
- **Heavy work goes in a Web Worker** (see `src/workers/`). Large WebAssembly payloads should be loaded lazily and announced with a `notice` in the registry entry.

## Pull requests

- Keep PRs focused, one tool or one fix where possible.
- **The PR title must be a [Conventional Commit](https://www.conventionalcommits.org/)** (`feat: add JWT decoder`, `fix(dns): handle empty TXT records`). PRs are squash-merged, the title becomes the commit, and release-please uses it to pick the next version and write the changelog. A check enforces this.
- Run `bun run check` before pushing.
- For UI changes, add before/after screenshots (light and dark) to the PR description.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please). Merged PRs accumulate in a release PR. Merging that PR tags the version, deploys good.tools, and publishes `ghcr.io/good-tools/good.tools` for amd64 and arm64.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
