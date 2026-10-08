import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import init from '@virustotal/yara-x'
import { beforeAll, describe, expect, it } from 'vitest'
import { compileAndScan, EXAMPLE_RULE, EXAMPLE_SAMPLE, parseDiagnostic, snippet } from './yara'

const enc = (s: string) => new TextEncoder().encode(s)

beforeAll(async () => {
  const js = createRequire(import.meta.url).resolve('@virustotal/yara-x')
  await init({ module_or_path: readFileSync(path.join(path.dirname(js), 'yara_x_js_bg.wasm')) })
})

describe('parseDiagnostic', () => {
  it('extracts the title and position', () => {
    const d = parseDiagnostic('error[E009]: unknown identifier `foo`\n --> line:2:47\n  |', 'error')
    expect(d).toMatchObject({ title: 'error[E009]: unknown identifier `foo`', line: 2, column: 47 })
  })
})

describe('snippet', () => {
  it('renders hex and printable ASCII, capped', () => {
    expect(snippet(new Uint8Array([0x41, 0x00, 0x7f, 0x42]), 0, 4)).toEqual({
      hex: '41 00 7f 42',
      ascii: 'A..B',
      truncated: false,
    })
    expect(snippet(new Uint8Array(64), 0, 64)).toMatchObject({ truncated: true })
    expect(snippet(new Uint8Array(64), 0, 64).hex.split(' ')).toHaveLength(32)
  })
})

describe('compileAndScan', () => {
  it('reports every compile error with its line', () => {
    const r = compileAndScan('rule a { condition: foo }\nrule b { condition: bar }', [])
    expect(r.samples).toBeUndefined()
    expect(r.diagnostics.map((d) => [d.severity, d.line])).toEqual([
      ['error', 1],
      ['error', 2],
    ])
  })

  it('returns warnings alongside results', () => {
    const r = compileAndScan('rule a { strings: $h = { 61 62 } condition: $h }', [])
    expect(r.diagnostics[0]).toMatchObject({ severity: 'warning', line: 1 })
    expect(r.samples).toEqual([])
  })

  it('matches the example rule against the example sample', () => {
    const r = compileAndScan(EXAMPLE_RULE, [
      { name: 'sample.ps1', bytes: enc(EXAMPLE_SAMPLE) },
      { name: 'clean.txt', bytes: enc('nothing to see') },
    ])
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const [hit, clean] = r.samples ?? []
    expect(clean?.matches).toEqual([])
    expect(hit?.matches.map((m) => m.identifier)).toEqual(['Suspicious_PowerShell_Download', 'Contains_URL'])
    const rule = hit?.matches[0]
    if (!rule) throw new Error('no match')
    expect(rule.tags).toEqual(['powershell', 'downloader'])
    expect(rule.metadata).toContainEqual({ identifier: 'severity', value: 7 })
    const dl = rule.patterns.find((p) => p.identifier === '$dl1')?.matches[0]
    expect(dl).toMatchObject({ offset: EXAMPLE_SAMPLE.indexOf('DownloadString'), ascii: 'DownloadString' })
  })
})
