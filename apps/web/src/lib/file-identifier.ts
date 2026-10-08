/** Pure helpers for File Identifier: Magika's input features, magic-byte signatures and the verdict. */

/** Bytes Magika reads from each end of a file (config.min.json: block_size) */
export const BLOCK = 4096

export interface MagikaConfig {
  beg_size: number
  end_size: number
  padding_token: number
  block_size: number
}

const WHITESPACE = new Set([...' \t\n\r\v\f'].map((c) => c.charCodeAt(0)))

/**
 * Magika's model input: the first `beg_size` bytes after leading whitespace, padded at the end,
 * then the last `end_size` bytes before trailing whitespace, padded at the start (same as the official bindings).
 */
export function magikaFeatures(head: Uint8Array, tail: Uint8Array, c: MagikaConfig): Int32Array {
  const out = new Int32Array(c.beg_size + c.end_size).fill(c.padding_token)
  let s = 0
  const h = head.subarray(0, c.block_size)
  while (s < h.length && WHITESPACE.has(h[s]!)) s++
  out.set(h.subarray(s, s + c.beg_size), 0)
  const t = tail.subarray(Math.max(0, tail.length - c.block_size))
  let e = t.length
  while (e > 0 && WHITESPACE.has(t[e - 1]!)) e--
  const end = t.subarray(Math.max(0, e - c.end_size), e)
  out.set(end, c.beg_size + c.end_size - end.length)
  return out
}

export interface Signature {
  name: string
  /** Extensions this signature is expected under */
  exts: string[]
  executable?: boolean
}

const ZIP_EXTS = [
  'zip',
  'docx',
  'xlsx',
  'pptx',
  'odt',
  'ods',
  'odp',
  'epub',
  'jar',
  'apk',
  'aar',
  'ipa',
  'xpi',
  'whl',
  'nupkg',
  'vsix',
  'kmz',
  '3mf',
  'npz',
  'crx',
]
const OLE_EXTS = ['doc', 'xls', 'ppt', 'msi', 'msg', 'one', 'pub', 'vsd']
const EXE_EXTS = ['exe', 'dll', 'sys', 'scr', 'com', 'ocx', 'cpl', 'efi', 'msi']

// [offset, bytes (hex, '..' = any byte), signature]
const SIGNATURES: [number, string, Signature][] = [
  [0, '25504446', { name: 'PDF document', exts: ['pdf', 'ai'] }],
  [0, '504b0304', { name: 'ZIP archive', exts: ZIP_EXTS }],
  [0, '504b0506', { name: 'ZIP archive (empty)', exts: ZIP_EXTS }],
  [0, '4d5a', { name: 'Windows executable (MZ)', exts: EXE_EXTS, executable: true }],
  [0, '7f454c46', { name: 'ELF executable', exts: ['so', 'elf', 'bin', 'o', 'ko', 'axf'], executable: true }],
  [0, 'cffaedfe', { name: 'Mach-O executable', exts: ['dylib', 'bundle', 'o'], executable: true }],
  [0, 'cefaedfe', { name: 'Mach-O executable', exts: ['dylib', 'bundle', 'o'], executable: true }],
  [0, 'cafebabe', { name: 'Java class / Mach-O universal', exts: ['class', 'dylib'], executable: true }],
  [0, '0061736d', { name: 'WebAssembly module', exts: ['wasm'], executable: true }],
  [
    0,
    '2321',
    { name: 'Script with shebang', exts: ['sh', 'bash', 'zsh', 'py', 'pl', 'rb', 'js', 'mjs', 'php', 'command'] },
  ],
  [0, '89504e470d0a1a0a', { name: 'PNG image', exts: ['png', 'apng'] }],
  [0, 'ffd8ff', { name: 'JPEG image', exts: ['jpg', 'jpeg', 'jpe', 'jfif'] }],
  [0, '47494638', { name: 'GIF image', exts: ['gif'] }],
  [0, '00000100', { name: 'ICO icon', exts: ['ico'] }],
  [0, '52494646........57454250', { name: 'WebP image', exts: ['webp'] }],
  [0, '52494646........57415645', { name: 'WAV audio', exts: ['wav'] }],
  [0, '52494646........41564920', { name: 'AVI video', exts: ['avi'] }],
  [
    4,
    '66747970',
    { name: 'ISO media (MP4/MOV/HEIC/AVIF)', exts: ['mp4', 'm4a', 'm4v', 'mov', 'heic', 'heif', 'avif', '3gp', '3g2'] },
  ],
  [0, '1a45dfa3', { name: 'Matroska / WebM', exts: ['mkv', 'webm', 'mka'] }],
  [0, '494433', { name: 'MP3 audio (ID3)', exts: ['mp3'] }],
  [0, '4f676753', { name: 'Ogg', exts: ['ogg', 'oga', 'ogv', 'opus'] }],
  [0, '664c6143', { name: 'FLAC audio', exts: ['flac'] }],
  [0, '1f8b', { name: 'Gzip', exts: ['gz', 'tgz', 'svgz'] }],
  [0, '425a68', { name: 'Bzip2', exts: ['bz2', 'tbz2'] }],
  [0, 'fd377a585a00', { name: 'XZ', exts: ['xz', 'txz'] }],
  [0, '28b52ffd', { name: 'Zstandard', exts: ['zst'] }],
  [0, '377abcaf271c', { name: '7-Zip archive', exts: ['7z'] }],
  [0, '526172211a07', { name: 'RAR archive', exts: ['rar'] }],
  [257, '7573746172', { name: 'TAR archive', exts: ['tar'] }],
  [0, 'd0cf11e0a1b11ae1', { name: 'OLE2 compound file (legacy Office / MSI)', exts: OLE_EXTS }],
  [0, '53514c69746520666f726d6174203300', { name: 'SQLite database', exts: ['sqlite', 'sqlite3', 'db', 'db3'] }],
  [0, '7b5c72746631', { name: 'RTF document', exts: ['rtf', 'doc'] }],
  [0, '25215053', { name: 'PostScript', exts: ['ps', 'eps', 'ai'] }],
  [0, '4c0000000114020000000000c000000000000046', { name: 'Windows shortcut (LNK)', exts: ['lnk'], executable: true }],
  [0, '4d534346', { name: 'Microsoft Cabinet', exts: ['cab'] }],
  [0, '213c617263683e', { name: 'Unix ar / Debian package', exts: ['deb', 'a', 'ar'] }],
  [0, 'edabeedb', { name: 'RPM package', exts: ['rpm'] }],
  [0, '38425053', { name: 'Photoshop document', exts: ['psd'] }],
  [0, '774f4646', { name: 'WOFF font', exts: ['woff'] }],
  [0, '774f4632', { name: 'WOFF2 font', exts: ['woff2'] }],
  [0, '4f54544f', { name: 'OpenType font', exts: ['otf'] }],
  [0, '0001000000', { name: 'TrueType font', exts: ['ttf'] }],
]

/** The first known magic-byte signature at the start of the file, if any */
export function matchSignature(head: Uint8Array): Signature | null {
  for (const [offset, hex, sig] of SIGNATURES) {
    const pairs = hex.match(/../g) ?? []
    if (head.length < offset + pairs.length) continue
    if (pairs.every((p, i) => p === '..' || head[offset + i] === Number.parseInt(p, 16))) return sig
  }
  return null
}

/** Lower-case extension without the dot ('' when there is none) */
export const extensionOf = (name: string) => /[^/\\]\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase() ?? ''

export interface ContentTypeInfo {
  label: string
  description: string
  mime_type: string | null
  group: string | null
  extensions: string[]
  is_text: boolean
}

export type Status = 'match' | 'mismatch' | 'danger' | 'unknown'

export interface Verdict {
  status: Status
  reason: string
}

/**
 * Compares the claimed extension with what the magic bytes and Magika say. Magic bytes are hard evidence, so a
 * signature that fits the name settles it. A mismatch is 'danger' when the content is executable and the name
 * doesn't say so.
 */
export function verdict(ext: string, detected: ContentTypeInfo, sig: Signature | null): Verdict {
  const known = !['unknown', 'empty', 'undefined'].includes(detected.label)
  const what = sig?.name ?? detected.description
  if (!ext) return { status: 'unknown', reason: sig || known ? `No extension; content is ${what}` : 'No extension' }
  const match: Verdict = { status: 'match', reason: `Content matches .${ext}` }
  if (sig) {
    // Magika may know a name the table doesn't (a shebang in a .ts), but never overrules executable bytes
    if (sig.exts.includes(ext) || (!sig.executable && detected.extensions.includes(ext))) return match
  } else {
    if (!known) return { status: 'unknown', reason: 'Content type could not be determined' }
    if (detected.extensions.includes(ext)) return match
    // Text formats overlap a lot (a .txt holding Markdown, a .conf holding INI); only flag them softly
    if (detected.is_text) return { status: 'unknown', reason: `Text file; looks like ${what}` }
  }
  const executable = sig ? !!sig.executable : detected.group === 'executable'
  return {
    status: executable && !EXE_EXTS.includes(ext) ? 'danger' : 'mismatch',
    reason: `Named .${ext} but content is ${what}`,
  }
}

/** Classic hex dump rows: offset, 16 hex bytes, printable ASCII */
export function hexRows(bytes: Uint8Array): [string, string, string][] {
  const rows: [string, string, string][] = []
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.subarray(i, i + 16)
    rows.push([
      i.toString(16).padStart(8, '0'),
      Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' '),
      Array.from(chunk, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join(''),
    ])
  }
  return rows
}
