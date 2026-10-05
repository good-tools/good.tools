# good.tools

Free, fast, privacy-focused developer tools that run in your browser.

**Live:** [good.tools](https://good.tools)

![good.tools](docs/screenshot.png)

- **Private.** Most tools run entirely client-side, some of them with WebAssembly (Wireshark, libvips, mesh repair). Tools that call a server are labelled **Online**.
- **Fast.** Each tool is code-split and loads only when you open it. Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> or <kbd>/</kbd> to jump to any tool.
- **Self-hostable.** One Docker image, configured at runtime.

| Category        | Tools                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| **Development** | Diff Checker, JSON Formatter, JSON Escape, XML Formatter, Docker Browser      |
| **Encoding**    | Base64, URL Encoder/Decoder, Protobuf Decoder                                 |
| **Security**    | Certificate Decoder, Java Object Deserializer, Hash Calculator                |
| **Network**     | Packet Dissector (Wireshark), DNS Lookup, WHOIS, What's My IP, IP to Location |
| **Image**       | Image Converter                                                               |
| **3D & CAD**    | STL Repair                                                                    |

## Development

Requires [Bun](https://bun.sh) ≥ 1.2.

```bash
bun install
bun run dev        # http://localhost:3000
bun run check      # type-check + lint + tests
bun run build      # sitemap + type-check + production build into dist/
```

Stack: React 19, React Router, Vite, Tailwind CSS 4, TanStack Query, zustand, Vitest.

### Project layout

```
src/
  config/tools.config.ts   # the tool registry: the single list of every tool
  tools/                   # one component per tool (lazy-loaded)
  workers/                 # web workers (Wireshark, libvips, mesh repair)
  components/ui/           # design system: Workspace, Split, Panel, Button, Input, Alert, …
  components/shell/        # header, sidebar, command palette
  pages/                   # home, tool page wrapper, 404
```

### Adding a tool

1. Create `src/tools/MyTool.tsx` with a default-exported component. The page wrapper already renders the title bar (name, description, local/online badge), so start with the tool's own UI. Use the layout from `@/components/ui/toolbar`: a `Workspace` (a toolbar row plus a full-height body) holding a `Split` of input and output `Panel`s. Show results live as the user types where that's cheap. `src/tools/Base64.tsx` is the reference implementation.
2. Add an entry to `src/config/tools.config.ts`:

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

## Self-hosting

Every release is published to the GitHub Container Registry for `linux/amd64` and `linux/arm64`:

```bash
docker run -p 3000:80 ghcr.io/good-tools/good.tools:latest
```

In production, pin a release version tag (`ghcr.io/good-tools/good.tools:<version>`) rather than `latest`; see [Releases](https://github.com/good-tools/good.tools/releases). To build it yourself instead, run `docker build -t good-tools .`.

By default, self-hosted instances send no telemetry and hide online tools. To enable the online tools, run the backend services and point the image at them:

```bash
docker run -p 3000:80 \
  -e DISABLE_ONLINE_TOOLS=false \
  -e INTERNET_TOOLS_URL=https://your-api.example.com \
  -e IMAGE_BROWSER_URL=https://your-images-api.example.com \
  ghcr.io/good-tools/good.tools:latest
```

| Variable               | Default | Description                       |
| ---------------------- | ------- | --------------------------------- |
| `PORT`                 | `80`    | Nginx listen port                 |
| `ENABLE_TELEMETRY`     | `false` | Enable Google Analytics           |
| `GA_TRACKING_ID`       | `""`    | GA4 tracking ID                   |
| `DISABLE_ONLINE_TOOLS` | `true`  | Hide tools that need backend APIs |
| `INTERNET_TOOLS_URL`   | `""`    | DNS / WHOIS / IP API base URL     |
| `IMAGE_BROWSER_URL`    | `""`    | Docker image browser API base URL |

If you serve `dist/` from somewhere else, send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. The image converter needs them for multi-threaded WebAssembly.

## Contributing

PRs are welcome. Run `bun run check` before you push. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

Releases are automatic. PRs are squash-merged, so the PR title must be a Conventional Commit; it decides the next version. [release-please](https://github.com/googleapis/release-please) keeps a release PR open with the next version and changelog. Merging that PR tags the release, deploys the site, and publishes the multi-arch image to `ghcr.io/good-tools/good.tools`. The version is shown in the site header.

## License

MIT
