# @goodtools/wasmpatch

Pinned upstream sources and Brave-style patches for WebAssembly (Emscripten) builds.

A library that compiles third-party C/C++ to WebAssembly usually has to download those sources at known versions and carry its own changes to them. `wasmpatch` handles both:

- **Pins and verifies** every upstream tarball (URL + sha256/sha512) in one `upstream.json`, next to the toolchain versions.
- **Keeps your changes reviewable**: one `patches/<source>/<file>.patch` per modified upstream file, with a free-text rationale above the diff, and new files verbatim in `overlay/<source>/`.
- **Makes upstream bumps mechanical**: `bump` rebases your patches onto the new version with git and stops with clear instructions on conflicts.
- **Gives CI a cache key** that changes exactly when the pins, patches or overlays change.

It is a single dependency-free script that only needs `node` (16+, including the Node bundled with emsdk), `curl`, `tar` and `git`. It came out of [wiregasm](https://github.com/good-tools/wiregasm)'s build, where it maintains 100+ patches to glib and Wireshark.

## `upstream.json`

```json
{
  "toolchain": { "emsdk": "4.0.23", "meson": "1.9.1" },
  "sources": {
    "vcglib": {
      "url": "https://github.com/cnr-isti-vclab/vcglib/archive/refs/tags/2025.07.tar.gz",
      "sha256": "e49fc9342d5476b3e39a5e1939b965b57c91d7a17b4f97b8c5eaf01228b16cf0"
    }
  }
}
```

`strip` (default `1`) sets how many leading path components to drop when extracting. `toolchain` is free-form; read values with `wasmpatch print toolchain.emsdk`.

## Commands

| Command | What it does |
| --- | --- |
| `wasmpatch fetch [source…]` | Download into the cache and verify the checksum; a bad download never lands |
| `wasmpatch apply [source…]` | Fresh `build/src/<source>`: upstream, then `overlay/`, then every patch. All failing patches are reported, not just the first |
| `wasmpatch export <source>` | Turn your edits in `build/src/<source>` back into `patches/` and `overlay/` (new files must be `git add`ed) |
| `wasmpatch bump <source> --url U --sha256 H` | Move to a new upstream version, rebase the patches, update `upstream.json` |
| `wasmpatch check` | Apply every source; non-zero exit if any patch fails |
| `wasmpatch status` | Per source: patch/overlay counts, prepared, unexported edits |
| `wasmpatch cache-key` | Hash of the config, patches and overlays (use it in CI cache keys) |
| `wasmpatch print <key.path>` | Print a config value |

Options: `--config <file>` (default `./upstream.json`). Downloads are cached in `$WASMPATCH_CACHE` (default `.cache/tarballs` next to the config), named by checksum so several libraries can share one cache.

## Workflow

```bash
wasmpatch apply vcglib                  # build/src/vcglib = upstream + overlay + patches
$EDITOR build/src/vcglib/some/file.h    # change upstream
git -C build/src/vcglib add new-file.c  # new files need `git add`
wasmpatch export vcglib                 # → patches/vcglib/some-file.h.patch, overlay/vcglib/new-file.c
```

`apply` refuses to throw away edits you haven't exported. Patch files are deterministic (diff settings are pinned), so re-exporting an unchanged tree produces no diff.

## Building with the pinned toolchain

`Dockerfile.emsdk` builds an Emscripten image (plus meson and ninja) for the versions in `upstream.json`:

```bash
docker build -f Dockerfile.emsdk \
  --build-arg EMSDK_VERSION=$(wasmpatch print toolchain.emsdk) \
  --build-arg MESON_VERSION=$(wasmpatch print toolchain.meson) \
  -t emsdk-builder .
```

See [`packages/meshrepair/scripts/build-wasm.mjs`](../../packages/meshrepair/scripts/build-wasm.mjs) for a complete build: it skips work when the inputs are unchanged, reuses published binaries built from the same inputs, and otherwise compiles with Emscripten or inside this image.

## License

MIT
