# good.tools

Free, fast, privacy-focused developer tools that run in your browser.

**Live:** [good.tools](https://good.tools)

![good.tools](docs/screenshot.png)

- **Private.** Most tools run entirely client-side, some of them with WebAssembly (Wireshark, libvips, mesh repair). Tools that call a server are labelled **Online**.
- **Fast.** Each tool is code-split and loads only when you open it. Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> or <kbd>/</kbd> to jump to any tool.
- **Self-hostable.** One Docker image, configured at runtime.

| Category        | Tools                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| **Development** | MCP Browser, Diff Checker, JSON Formatter, JSON Escape, XML Formatter, Docker Browser      |
| **Encoding**    | Base64, URL Encoder/Decoder, Protobuf Decoder                                 |
| **Security**    | JWT Decoder, Certificate Decoder, Java Object Deserializer, Hash Calculator                |
| **Network**     | Packet Dissector (Wireshark), DNS Lookup, WHOIS, What's My IP, IP to Location |
| **Image**       | Image Converter                                                               |
| **3D & CAD**    | STL Repair                                                                    |

## Development

```bash
bun install
bun run dev        # http://localhost:3000
bun run check      # type-check, Biome lint + format, tests
```

Stack: React 19, React Router, Vite, Tailwind CSS 4, TanStack Query, zustand, Biome, Vitest; a Bun workspaces + Turborepo monorepo.

| Path | What |
| --- | --- |
| `apps/web` | the good.tools web app |
| `packages/jdserialize`, `packages/protobuf-decoder` | npm libraries behind the Java and Protobuf decoders |
| `packages/meshrepair` | STL mesh repair compiled to WebAssembly (C++/VCGlib) |
| `tools/wasmpatch` | pinned upstream sources + patches for WebAssembly builds |

To add a tool, read [CONTRIBUTING.md](CONTRIBUTING.md). It covers the project layout, the tool registry, the UI guidelines and the PR process.

## Self-hosting

Every release is published to the GitHub Container Registry for `linux/amd64` and `linux/arm64`:

```bash
docker run -p 3000:80 ghcr.io/good-tools/good.tools:latest
```

In production, pin a release version tag (`ghcr.io/good-tools/good.tools:<version>`) rather than `latest`; see [Releases](https://github.com/good-tools/good.tools/releases). To build it yourself instead, run `docker build -f apps/web/Dockerfile -t good-tools .` from the repository root.

The image is a single Go binary ([`services/api`](services/api)) that serves the web app and the API behind the online tools (DNS, WHOIS, IP location, Docker Browser). It sends no telemetry. The online tools need outbound internet access, and IP location downloads a geolocation database at startup. For an offline instance, set `DISABLE_ONLINE_TOOLS=true`.

| Variable               | Default | Description                                                            |
| ---------------------- | ------- | ---------------------------------------------------------------------- |
| `PORT`                 | `80`    | Listen port (use a port above 1024 outside Docker; the image runs as nonroot) |
| `DISABLE_ONLINE_TOOLS` | `false` | Hide the online tools and turn the API off                             |
| `API_URL`              | `/api`  | Where the web app calls the API, e.g. `https://api.good.tools`         |
| `ENABLE_TELEMETRY`     | `false` | Enable Google Analytics                                                |
| `GA_TRACKING_ID`       | `""`    | GA4 tracking ID                                                        |

The API has more settings, such as rate limits, the image size limit and a MaxMind key; see [`services/api`](services/api/README.md). Mount a volume at `/data` to keep its caches across restarts.

If you serve `dist/` from somewhere else, send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. The image converter needs them for multi-threaded WebAssembly.

## Contributing

Contributions are welcome, whether a bug report, a new tool or a fix. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

### Contributors

<a href="https://github.com/good-tools/good.tools/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=good-tools/good.tools" alt="Contributors" />
</a>

## License

[MIT](LICENSE)
