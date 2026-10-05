#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// wasmpatch: pinned upstream sources + Brave-style patches for WebAssembly builds.
//
// A library describes its upstream sources in `upstream.json`:
//
//   {
//     "toolchain": { "emsdk": "4.0.23" },
//     "sources": {
//       "vcglib": {
//         "url": "https://github.com/cnr-isti-vclab/vcglib/archive/refs/tags/2025.07.tar.gz",
//         "sha256": "…",          // or "sha512"
//         "strip": 1              // leading path components to drop (default 1)
//       }
//     }
//   }
//
// Changes to a source live next to the config, one patch per modified upstream
// file in patches/<source>/ and new files verbatim in overlay/<source>/. A
// prepared source is a git repo in build/src/<source> with an `upstream` tag
// (the pristine tarball) and a `patched` tag (overlay + patches applied).
//
//   wasmpatch fetch [source…]          download + verify tarballs into the cache
//   wasmpatch apply [source…]          fresh build/src/<source>: upstream + overlay + patches
//   wasmpatch export <source>          regenerate patches/ + overlay/ from your edits in build/src
//   wasmpatch bump <source> --url U (--sha256|--sha512) H
//                                      move to a new upstream version and rebase the patches
//   wasmpatch check                    apply every source; non-zero exit if a patch fails
//   wasmpatch status                   per source: prepared? unexported edits? patch counts
//   wasmpatch cache-key                hash of the config, patches and overlays (CI cache keys)
//   wasmpatch print <key.path>         print a config value, e.g. `toolchain.emsdk`
//
// Options: --config <file> (default ./upstream.json). Downloads are cached in
// $WASMPATCH_CACHE (default <config dir>/.cache/tarballs).
//
// Dependency-free and limited to old Node APIs so it also runs on the Node
// bundled with emsdk. Needs curl, tar and git on PATH.

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

function die(msg) {
  console.error(`wasmpatch: ${msg}`)
  process.exit(1)
}

function git(cwd, ...args) {
  return execFileSync(
    'git',
    // The tree may be owned by another user (e.g. root inside Docker), and the
    // user's git config must not change the result.
    ['-c', 'safe.directory=*', '-c', 'user.name=wasmpatch', '-c', 'user.email=wasmpatch@localhost', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

// ---------------------------------------------------------------------------
// config

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      flags[k] = v !== undefined ? v : argv[++i]
    } else positional.push(a)
  }
  return { positional, flags }
}

function loadConfig(file) {
  const configPath = path.resolve(file)
  if (!fs.existsSync(configPath)) die(`no config at ${configPath}`)
  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (e) {
    die(`${configPath} is not valid JSON: ${e.message}`)
  }
  const root = path.dirname(configPath)
  const sources = config.sources || {}
  for (const [name, s] of Object.entries(sources)) {
    if (!s.url) die(`source "${name}" has no url`)
    if (!s.sha256 && !s.sha512) die(`source "${name}" needs a sha256 or sha512 checksum`)
  }
  return {
    path: configPath,
    root,
    raw: config,
    sources,
    cacheDir: process.env.WASMPATCH_CACHE || path.join(root, '.cache', 'tarballs'),
    patchDir: (name) => path.join(root, 'patches', name),
    overlayDir: (name) => path.join(root, 'overlay', name),
    srcDir: (name) => path.join(root, 'build', 'src', name),
  }
}

function sourceNames(cfg, requested) {
  const all = Object.keys(cfg.sources)
  for (const n of requested) if (!all.includes(n)) die(`unknown source "${n}" (known: ${all.join(', ') || 'none'})`)
  return requested.length ? requested : all
}

function saveConfig(cfg) {
  fs.writeFileSync(cfg.path, `${JSON.stringify(cfg.raw, null, 2)}\n`)
}

// ---------------------------------------------------------------------------
// fetch

function digest(file, algo) {
  return crypto.createHash(algo).update(fs.readFileSync(file)).digest('hex')
}

function checksum(source) {
  return source.sha512 ? { algo: 'sha512', hex: source.sha512 } : { algo: 'sha256', hex: source.sha256 }
}

/** Content-addressed path, so sources (and libraries sharing a cache) never collide. */
function tarballPath(cfg, source) {
  const { hex } = checksum(source)
  const file = path.basename(new URL(source.url).pathname) || 'source.tar'
  return path.join(cfg.cacheDir, `${hex.slice(0, 16)}-${file}`)
}

/** Downloads and verifies; a failed download or checksum never leaves a file at the final path. */
function fetchSource(cfg, name, source) {
  const dest = tarballPath(cfg, source)
  if (fs.existsSync(dest)) return dest
  fs.mkdirSync(cfg.cacheDir, { recursive: true })
  const tmp = `${dest}.tmp`
  console.log(`wasmpatch: fetching ${name} from ${source.url}`)
  try {
    execFileSync('curl', ['-fsSL', '--retry', '3', '-o', tmp, source.url], { stdio: ['ignore', 'inherit', 'inherit'] })
  } catch {
    fs.rmSync(tmp, { force: true })
    die(`download of ${name} failed: ${source.url}`)
  }
  const { algo, hex } = checksum(source)
  const actual = digest(tmp, algo)
  if (actual !== hex) {
    fs.rmSync(tmp, { force: true })
    die(`${algo} mismatch for ${name}:\n  expected ${hex}\n  actual   ${actual}`)
  }
  fs.renameSync(tmp, dest)
  return dest
}

// ---------------------------------------------------------------------------
// apply / export / bump (git-tagged upstream → patched trees)

function copyTree(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true })
      copyTree(from, to)
    } else fs.copyFileSync(from, to)
  }
}

function extract(tarball, dest, strip) {
  execFileSync('tar', ['xf', tarball, '-C', dest, `--strip-components=${strip}`])
}

function patchFiles(dir) {
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.patch'))
        .sort()
    : []
}

function unexported(dest) {
  return fs.existsSync(path.join(dest, '.git')) ? git(dest, 'status', '--porcelain', '--untracked-files=no').trim() : ''
}

function apply(cfg, name) {
  const source = cfg.sources[name]
  const dest = cfg.srcDir(name)
  const dirty = unexported(dest)
  if (dirty) {
    die(
      `${dest} has unexported changes:\n${dirty}\n` +
        `Export them with \`wasmpatch export ${name}\`, or discard them with \`rm -rf ${dest}\`.`,
    )
  }
  const tarball = fetchSource(cfg, name, source)

  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(dest, { recursive: true })
  extract(tarball, dest, source.strip === undefined ? 1 : source.strip)
  git(dest, 'init', '-q')
  // -f: tarballs often ship files their own .gitignore excludes (generated sources).
  git(dest, 'add', '-A', '-f')
  git(dest, 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'upstream')
  git(dest, 'tag', 'upstream')

  const overlay = cfg.overlayDir(name)
  if (fs.existsSync(overlay)) copyTree(overlay, dest)

  const patchDir = cfg.patchDir(name)
  const patches = patchFiles(patchDir)
  const failed = []
  for (const p of patches) {
    try {
      git(dest, 'apply', '--whitespace=nowarn', path.join(patchDir, p))
    } catch (e) {
      failed.push(`  ${p}\n${String(e.stderr).replace(/^/gm, '    ')}`)
    }
  }
  if (failed.length) die(`${failed.length}/${patches.length} patches failed for ${name}:\n${failed.join('\n')}`)

  git(dest, 'add', '-A', '-f')
  git(dest, 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'patched')
  git(dest, 'tag', 'patched')
  console.log(`wasmpatch: ${name} ready in ${path.relative(process.cwd(), dest) || '.'} (${patches.length} patches)`)
}

// Pinned so the patches are byte-identical on every machine, whatever the user's git config says.
const DIFF_ARGS = [
  '-c',
  'diff.algorithm=histogram',
  '-c',
  'core.quotePath=false',
  'diff',
  '--no-ext-diff',
  '--no-color',
  '--no-renames',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--full-index',
  'upstream',
]

function exportPatches(cfg, name) {
  const dest = cfg.srcDir(name)
  if (!fs.existsSync(path.join(dest, '.git'))) die(`${name} is not prepared; run \`wasmpatch apply ${name}\` first`)
  // Includes new files that were `git add`ed but not committed.
  const changed = (filter) =>
    git(dest, 'diff', '--name-only', '--no-renames', `--diff-filter=${filter}`, 'upstream').split('\n').filter(Boolean)

  const deleted = changed('D')
  if (deleted.length) die(`deleting upstream files is not supported:\n  ${deleted.join('\n  ')}`)

  // Keep each patch's rationale (the text above the first `diff --git` line).
  const patchDir = cfg.patchDir(name)
  const headers = new Map()
  for (const f of patchFiles(patchDir)) {
    const text = fs.readFileSync(path.join(patchDir, f), 'utf8')
    const i = text.indexOf('diff --git ')
    if (i > 0) headers.set(f, text.slice(0, i))
    fs.unlinkSync(path.join(patchDir, f))
  }

  const modified = changed('M')
  if (modified.length) fs.mkdirSync(patchDir, { recursive: true })
  for (const file of modified) {
    const patchName = `${file.replace(/\//g, '-')}.patch`
    fs.writeFileSync(
      path.join(patchDir, patchName),
      (headers.get(patchName) || '') + git(dest, ...DIFF_ARGS, '--', file),
    )
  }

  const overlay = cfg.overlayDir(name)
  fs.rmSync(overlay, { recursive: true, force: true })
  const added = changed('A')
  for (const file of added) {
    fs.mkdirSync(path.dirname(path.join(overlay, file)), { recursive: true })
    fs.copyFileSync(path.join(dest, file), path.join(overlay, file))
  }

  // The tree matches patches/ and overlay/ again.
  git(dest, 'add', '-u')
  git(dest, 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'patched')
  git(dest, 'tag', '-f', 'patched')
  console.log(`wasmpatch: ${name}: ${modified.length} patches, ${added.length} overlay files`)
}

function bump(cfg, name, flags) {
  const dest = cfg.srcDir(name)
  if (!flags.url || !(flags.sha256 || flags.sha512))
    die('usage: wasmpatch bump <source> --url <tarball-url> (--sha256|--sha512) <checksum> [--strip N]')
  if (!fs.existsSync(path.join(dest, '.git'))) apply(cfg, name)
  if (unexported(dest)) die(`${dest} has unexported changes; run \`wasmpatch export ${name}\` first`)

  const next = { ...cfg.sources[name], url: flags.url }
  delete next.sha256
  delete next.sha512
  if (flags.sha512) next.sha512 = flags.sha512
  else next.sha256 = flags.sha256
  if (flags.strip !== undefined) next.strip = Number(flags.strip)
  const tarball = fetchSource(cfg, name, next)

  git(dest, 'checkout', '-q', '-B', 'wasmpatch', 'patched')
  git(dest, 'checkout', '-q', '--detach', 'upstream')
  for (const entry of fs.readdirSync(dest)) {
    if (entry !== '.git') fs.rmSync(path.join(dest, entry), { recursive: true, force: true })
  }
  extract(tarball, dest, next.strip === undefined ? 1 : next.strip)
  git(dest, 'add', '-A', '-f')
  git(dest, 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'upstream (new)')
  const newUpstream = git(dest, 'rev-parse', 'HEAD').trim()
  const oldUpstream = git(dest, 'rev-parse', 'upstream').trim()
  git(dest, 'tag', '-f', 'upstream', newUpstream)

  // The pin moves now, so a conflicted rebase can be finished and exported against it.
  cfg.raw.sources[name] = next
  saveConfig(cfg)

  git(dest, 'checkout', '-q', 'wasmpatch')
  try {
    git(dest, 'rebase', '-q', '--onto', newUpstream, oldUpstream, 'wasmpatch')
  } catch {
    const conflicts = git(dest, 'diff', '--name-only', '--diff-filter=U').trim()
    die(
      `conflicts rebasing ${name} onto the new version:\n  ${conflicts.split('\n').join('\n  ')}\n` +
        `Fix them in ${dest}, \`git add\` them and run \`git rebase --continue\` there,\n` +
        `then \`wasmpatch export ${name}\`.`,
    )
  }
  git(dest, 'tag', '-f', 'patched')
  exportPatches(cfg, name)
  console.log(`wasmpatch: ${name} bumped to ${next.url}`)
}

// ---------------------------------------------------------------------------
// status / cache-key / print

function listFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

function status(cfg) {
  for (const name of sourceNames(cfg, [])) {
    const dest = cfg.srcDir(name)
    const prepared = fs.existsSync(path.join(dest, '.git'))
    const dirty = prepared && unexported(dest)
    console.log(
      `${name}: ${patchFiles(cfg.patchDir(name)).length} patches, ${listFiles(cfg.overlayDir(name)).length} overlay files, ` +
        (prepared ? (dirty ? 'prepared with UNEXPORTED edits' : 'prepared') : 'not prepared'),
    )
  }
}

/** Changes whenever the pins, toolchain, patches or overlays change. */
function cacheKey(cfg) {
  const hash = crypto.createHash('sha256')
  hash.update(JSON.stringify(cfg.raw))
  for (const name of sourceNames(cfg, [])) {
    for (const file of [...listFiles(cfg.patchDir(name)), ...listFiles(cfg.overlayDir(name))]) {
      hash.update(path.relative(cfg.root, file))
      hash.update(fs.readFileSync(file))
    }
  }
  return hash.digest('hex').slice(0, 32)
}

function print(cfg, key) {
  let value = cfg.raw
  for (const part of key.split('.')) value = value == null ? undefined : value[part]
  if (value === undefined) die(`no config value at "${key}"`)
  console.log(typeof value === 'object' ? JSON.stringify(value) : String(value))
}

// ---------------------------------------------------------------------------

const USAGE = `usage: wasmpatch <command> [--config upstream.json]
  fetch [source…]     download and verify upstream tarballs
  apply [source…]     prepare build/src/<source> (upstream + overlay + patches)
  export <source>     regenerate patches/ and overlay/ from build/src/<source>
  bump <source> --url U (--sha256|--sha512) H [--strip N]
  check               apply every source, fail on any broken patch
  status              show each source's state
  cache-key           print a hash of config + patches + overlays
  print <key.path>    print a config value, e.g. toolchain.emsdk`

const { positional, flags } = parseArgs(process.argv.slice(2))
const [cmd, ...args] = positional
if (!cmd || cmd === 'help' || flags.help !== undefined) {
  console.log(USAGE)
  process.exit(cmd ? 0 : 1)
}
const cfg = loadConfig(flags.config || 'upstream.json')

switch (cmd) {
  case 'fetch':
    for (const name of sourceNames(cfg, args)) fetchSource(cfg, name, cfg.sources[name])
    break
  case 'apply':
    for (const name of sourceNames(cfg, args)) apply(cfg, name)
    break
  case 'check':
    for (const name of sourceNames(cfg, [])) apply(cfg, name)
    console.log('wasmpatch: all patches apply')
    break
  case 'export':
    if (args.length !== 1) die('usage: wasmpatch export <source>')
    exportPatches(cfg, sourceNames(cfg, args)[0])
    break
  case 'bump':
    if (args.length !== 1) die('usage: wasmpatch bump <source> --url U (--sha256|--sha512) H')
    bump(cfg, sourceNames(cfg, args)[0], flags)
    break
  case 'status':
    status(cfg)
    break
  case 'cache-key':
    console.log(cacheKey(cfg))
    break
  case 'print':
    if (args.length !== 1) die('usage: wasmpatch print <key.path>')
    print(cfg, args[0])
    break
  default:
    die(`unknown command "${cmd}"\n${USAGE}`)
}
