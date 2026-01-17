# good.tools

A collection of free, fast, and privacy-focused developer tools that run entirely in your browser.

**Live:** [good.tools](https://good.tools)

## Features

- 🔒 **Privacy-first** - Most tools run 100% client-side
- ⚡ **Fast** - No server round-trips for offline tools
- 🎨 **Modern UI** - Dark mode, responsive design
- 🐳 **Self-hostable** - Run your own instance

### Tools

| Category | Tools |
|----------|-------|
| **Encoding** | Base64, URL Encoder, Protobuf Decoder |
| **Security** | Certificate Decoder, Hash Calculator, Java Deserializer |
| **Network** | DNS Lookup, WHOIS, What's My IP, IP Location, Packet Dissector |
| **Development** | JSON Formatter, XML Formatter, Diff Checker, Docker Browser |

## Self-Hosting

```bash
docker build -t good-tools .
docker run -p 3000:80 good-tools
```

By default, self-hosted instances have:
- ❌ Telemetry disabled
- ❌ Online tools hidden (require external APIs)

### Enable online tools

To enable tools that require backend APIs (DNS, WHOIS, etc.), you'll need to host the backend services and configure:

```bash
docker run -p 3000:80 \
  -e DISABLE_ONLINE_TOOLS=false \
  -e INTERNET_TOOLS_URL=https://your-api.example.com \
  -e IMAGE_BROWSER_URL=https://your-images-api.example.com \
  good-tools
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` | Nginx listen port |
| `ENABLE_TELEMETRY` | `false` | Enable Google Analytics |
| `GA_TRACKING_ID` | `""` | GA4 tracking ID |
| `DISABLE_ONLINE_TOOLS` | `true` | Hide online tools |
| `INTERNET_TOOLS_URL` | `""` | DNS/WHOIS/IP API URL |
| `IMAGE_BROWSER_URL` | `""` | Docker browser API URL |

## Development

```bash
npm install
npm run dev
```

### Scripts

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run test` - Run tests
- `npm run lint` - Lint code

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-tool`)
3. Make your changes
4. Run tests and linting (`npm run test && npm run lint`)
5. Commit with a descriptive message
6. Push and open a Pull Request

### Adding a new tool

1. Create component in `src/tools/YourTool.tsx`
2. Add route in `src/config/routes.config.ts`
3. Register in `src/config/tools.config.tsx` with:
   - `online: false` for client-side tools
   - `online: true` if it requires backend APIs

## License

MIT