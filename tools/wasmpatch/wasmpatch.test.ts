import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CLI = path.join(import.meta.dirname, 'wasmpatch.mjs')
let work: string

function run(...args: string[]) {
  const res = spawnSync('node', [CLI, ...args], { cwd: work, encoding: 'utf8' })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}

/** Makes lib-<version>.tar.gz containing lib-<version>/<files> and returns its file:// URL + sha256. */
function tarball(version: string, files: Record<string, string>) {
  const dir = path.join(work, 'upstreams', `lib-${version}`)
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), content)
  }
  const file = path.join(work, 'upstreams', `lib-${version}.tar.gz`)
  execFileSync('tar', ['czf', file, '-C', path.dirname(dir), path.basename(dir)])
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  return { url: `file://${file}`, sha256 }
}

function writeConfig(source: object) {
  fs.writeFileSync(
    path.join(work, 'upstream.json'),
    JSON.stringify({ toolchain: { emsdk: '4.0.23' }, sources: { lib: source } }, null, 2),
  )
}

const src = (file: string) => fs.readFileSync(path.join(work, 'build/src/lib', file), 'utf8')

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmpatch-'))
})
afterEach(() => fs.rmSync(work, { recursive: true, force: true }))

test('fetch verifies checksums and never leaves a bad download behind', () => {
  const v1 = tarball('1.0', { 'a.c': 'int a;\n' })
  writeConfig({ ...v1, sha256: '0'.repeat(64) })
  const bad = run('fetch')
  expect(bad.code).toBe(1)
  expect(bad.out).toContain('sha256 mismatch')
  expect(fs.readdirSync(path.join(work, '.cache/tarballs'))).toEqual([])

  writeConfig(v1)
  expect(run('fetch').code).toBe(0)
  expect(fs.readdirSync(path.join(work, '.cache/tarballs'))).toHaveLength(1)
})

test('apply → edit → export → apply round-trips, keeping patch rationale', () => {
  writeConfig(tarball('1.0', { 'src/a.c': 'int a = 1;\n', 'b.c': 'int b;\n' }))
  expect(run('apply').code).toBe(0)
  expect(src('src/a.c')).toBe('int a = 1;\n')

  // edit an upstream file and add a new one
  fs.writeFileSync(path.join(work, 'build/src/lib/src/a.c'), 'int a = 2;\n')
  fs.writeFileSync(path.join(work, 'build/src/lib/wasm.c'), 'int wasm;\n')
  execFileSync('git', ['-C', path.join(work, 'build/src/lib'), 'add', 'wasm.c'])

  // unexported edits are protected
  const refused = run('apply')
  expect(refused.code).toBe(1)
  expect(refused.out).toContain('unexported changes')

  expect(run('export', 'lib').code).toBe(0)
  const patchFile = path.join(work, 'patches/lib/src-a.c.patch')
  expect(fs.readFileSync(patchFile, 'utf8')).toContain('+int a = 2;')
  expect(fs.readFileSync(path.join(work, 'overlay/lib/wasm.c'), 'utf8')).toBe('int wasm;\n')

  // a rationale header survives re-export
  fs.writeFileSync(patchFile, `Why: emscripten needs a = 2\n\n${fs.readFileSync(patchFile, 'utf8')}`)
  expect(run('export', 'lib').code).toBe(0)
  expect(fs.readFileSync(patchFile, 'utf8')).toMatch(/^Why: emscripten needs a = 2/)

  fs.rmSync(path.join(work, 'build'), { recursive: true })
  expect(run('apply').code).toBe(0)
  expect(src('src/a.c')).toBe('int a = 2;\n')
  expect(src('wasm.c')).toBe('int wasm;\n')
  expect(run('status').out).toContain('lib: 1 patches, 1 overlay files, prepared')
})

test('apply protects new files that were never git-added', () => {
  writeConfig(tarball('1.0', { 'a.c': 'int a;\n' }))
  run('apply')
  fs.writeFileSync(path.join(work, 'build/src/lib/new.h'), 'int n;\n')
  const res = run('apply')
  expect(res.code).toBe(1)
  expect(res.out).toContain('new.h')
  expect(fs.existsSync(path.join(work, 'build/src/lib/new.h'))).toBe(true)
})

test('--help anywhere prints usage instead of running the command', () => {
  writeConfig(tarball('1.0', { 'a.c': 'int a;\n' }))
  const res = run('apply', '--help')
  expect(res.code).toBe(0)
  expect(res.out).toContain('usage: wasmpatch')
  expect(fs.existsSync(path.join(work, 'build'))).toBe(false)
})

test('check reports patches that no longer apply', () => {
  writeConfig(tarball('1.0', { 'a.c': 'int a = 1;\n' }))
  fs.mkdirSync(path.join(work, 'patches/lib'), { recursive: true })
  fs.writeFileSync(
    path.join(work, 'patches/lib/a.c.patch'),
    'diff --git a/a.c b/a.c\n--- a/a.c\n+++ b/a.c\n@@ -1 +1 @@\n-int a = 9;\n+int a = 2;\n',
  )
  const res = run('check')
  expect(res.code).toBe(1)
  expect(res.out).toContain('1/1 patches failed for lib')
})

test('bump rebases patches onto the new upstream and updates the pin', () => {
  writeConfig(tarball('1.0', { 'a.c': 'int a = 1;\nint keep;\n' }))
  run('apply')
  fs.writeFileSync(path.join(work, 'build/src/lib/a.c'), 'int a = 2;\nint keep;\n')
  run('export', 'lib')

  const v2 = tarball('2.0', { 'a.c': 'int a = 1;\nint keep;\nint added_upstream;\n' })
  const res = run('bump', 'lib', '--url', v2.url, '--sha256', v2.sha256)
  expect(res.code, res.out).toBe(0)
  expect(src('a.c')).toBe('int a = 2;\nint keep;\nint added_upstream;\n')
  const config = JSON.parse(fs.readFileSync(path.join(work, 'upstream.json'), 'utf8'))
  expect(config.sources.lib).toMatchObject({ url: v2.url, sha256: v2.sha256 })
})

test('cache-key tracks patches; print reads config values', () => {
  writeConfig(tarball('1.0', { 'a.c': 'x\n' }))
  const before = run('cache-key').out
  fs.mkdirSync(path.join(work, 'overlay/lib'), { recursive: true })
  fs.writeFileSync(path.join(work, 'overlay/lib/new.c'), 'y\n')
  expect(run('cache-key').out).not.toBe(before)
  expect(run('print', 'toolchain.emsdk').out.trim()).toBe('4.0.23')
})
