/** Compact ELF / PE / Mach-O header parser: overview, sections and segments, imports, exports and linked libraries. */

export interface Region {
  kind: 'Section' | 'Segment'
  name: string
  addr: bigint
  /** File offset of the region's bytes (absolute, also inside a universal Mach-O) */
  offset: number
  /** Bytes in the file (0 for zero-fill sections like .bss) */
  size: number
  /** Size in memory */
  memSize: number
  flags: string
  /** Shannon entropy of the file bytes in bits per byte; null when the region has no file bytes */
  entropy: number | null
}

export interface Import {
  name: string
  library: string
}

export interface Export {
  name: string
  addr: bigint
}

export interface BinaryInfo {
  format: 'ELF' | 'PE' | 'Mach-O'
  type: string
  arch: string
  bits: 32 | 64
  endian: 'Little' | 'Big'
  entry: bigint | null
  /** PE link time in seconds since the epoch (often a hash in reproducible builds) */
  timestamp?: number
  /** Format-specific extras shown on the overview */
  details: [string, string][]
  regions: Region[]
  imports: Import[]
  exports: Export[]
  libraries: string[]
}

export const hex = (n: bigint | number) => `0x${n.toString(16)}`

/** A user-typed file offset: `0x` prefix or any a-f digit means hex, plain digits are decimal. Null when invalid. */
export function parseOffset(s: string): number | null {
  s = s.trim()
  if (/^[0-9]+$/.test(s)) return Number(s)
  const m = /^(?:0x)?([0-9a-f]+)$/i.exec(s)
  return m ? Number.parseInt(m[1]!, 16) : null
}

export function entropy(b: Uint8Array): number {
  if (!b.length) return 0
  const counts = new Uint32Array(256)
  for (const x of b) counts[x]!++
  let h = 0
  for (const c of counts) {
    if (!c) continue
    const p = c / b.length
    h -= p * Math.log2(p)
  }
  return h
}

const utf8 = new TextDecoder()

class Reader {
  private v: DataView
  constructor(
    readonly bytes: Uint8Array,
    public le: boolean,
    /** Start of the image inside the file (a universal Mach-O slice) */
    readonly base = 0,
  ) {
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  u8 = (o: number) => this.v.getUint8(this.base + o)
  u16 = (o: number) => this.v.getUint16(this.base + o, this.le)
  u32 = (o: number) => this.v.getUint32(this.base + o, this.le)
  u64 = (o: number) => this.v.getBigUint64(this.base + o, this.le)
  /** Pointer-sized value */
  addr = (o: number, is64: boolean) => (is64 ? this.u64(o) : BigInt(this.u32(o)))
  /** NUL-terminated string, at most `max` bytes */
  str(o: number, max = 4096) {
    const start = this.base + o
    if (start < 0 || start >= this.bytes.length) throw new RangeError('String offset out of range')
    let end = start
    const limit = Math.min(this.bytes.length, start + max)
    while (end < limit && this.bytes[end] !== 0) end++
    return utf8.decode(this.bytes.subarray(start, end))
  }
  region(o: number, size: number): Uint8Array {
    const start = this.base + o
    return this.bytes.subarray(start, Math.min(this.bytes.length, start + size))
  }
}

const regionEntropy = (r: Reader, offset: number, size: number) =>
  size > 0 && offset < r.bytes.length - r.base ? entropy(r.region(offset, size)) : null

/** Runs a table parser; a malformed table yields what was read so far instead of failing the whole file. */
function guarded(warnings: string[], what: string, fn: () => void) {
  try {
    fn()
  } catch {
    warnings.push(`Could not fully read the ${what}`)
  }
}

export function parseBinary(bytes: Uint8Array): BinaryInfo {
  if (bytes.length < 64) throw new Error('File is too small to be an executable')
  const m = new Reader(bytes, true).u32(0)
  if (m === 0x464c457f) return parseElf(bytes)
  if ((m & 0xffff) === 0x5a4d) return parsePe(bytes)
  if (m === 0xfeedface || m === 0xfeedfacf || m === 0xcefaedfe || m === 0xcffaedfe) return parseMachO(bytes, 0, [])
  // Universal binaries share 0xcafebabe with Java classes; their arch count is small, a class version is >= 45
  if ((m === 0xbebafeca || m === 0xbfbafeca) && new Reader(bytes, false).u32(4) < 45) return parseFat(bytes)
  throw new Error('Not an ELF, PE or Mach-O file')
}

// ---------- ELF ----------

const ELF_TYPES: Record<number, string> = {
  1: 'Relocatable object',
  2: 'Executable',
  3: 'Shared object / PIE executable',
  4: 'Core dump',
}
const ELF_MACHINES: Record<number, string> = {
  2: 'SPARC',
  3: 'x86',
  8: 'MIPS',
  20: 'PowerPC',
  21: 'PowerPC64',
  22: 'S390',
  40: 'ARM',
  42: 'SuperH',
  43: 'SPARC V9',
  50: 'IA-64',
  62: 'x86-64',
  183: 'AArch64',
  243: 'RISC-V',
  247: 'BPF',
  258: 'LoongArch',
}
const ELF_OSABI: Record<number, string> = {
  0: 'System V',
  3: 'Linux',
  6: 'Solaris',
  9: 'FreeBSD',
  12: 'OpenBSD',
  97: 'ARM',
  255: 'Standalone',
}
const PT_TYPES: Record<number, string> = {
  0: 'NULL',
  1: 'LOAD',
  2: 'DYNAMIC',
  3: 'INTERP',
  4: 'NOTE',
  5: 'SHLIB',
  6: 'PHDR',
  7: 'TLS',
  1685382480: 'GNU_EH_FRAME',
  1685382481: 'GNU_STACK',
  1685382482: 'GNU_RELRO',
  1685382483: 'GNU_PROPERTY',
}

function parseElf(bytes: Uint8Array): BinaryInfo {
  const is64 = bytes[4] === 2
  if (bytes[4] !== 1 && !is64) throw new Error('Unknown ELF class')
  const r = new Reader(bytes, bytes[5] !== 2)
  const w = is64 ? 8 : 4
  const type = r.u16(16)
  const machine = r.u16(18)
  const entry = r.addr(24, is64)
  const phoff = Number(r.addr(24 + w, is64))
  const shoff = Number(r.addr(24 + 2 * w, is64))
  const h = 24 + 3 * w + 4 // e_ehsize
  const phentsize = r.u16(h + 2)
  const phnum = r.u16(h + 4)
  const shentsize = r.u16(h + 6)
  let shnum = r.u16(h + 8)
  const shstrndx = r.u16(h + 10)
  const details: [string, string][] = [['OS ABI', ELF_OSABI[bytes[7]!] ?? String(bytes[7])]]
  const warnings: string[] = []
  const regions: Region[] = []
  const imports: Import[] = []
  const exports: Export[] = []
  const libraries: string[] = []

  guarded(warnings, 'program headers', () => {
    for (let i = 0; i < phnum; i++) {
      const o = phoff + i * phentsize
      const pType = r.u32(o)
      // Field order differs: 64-bit puts p_flags right after p_type
      const flags = is64 ? r.u32(o + 4) : r.u32(o + 24)
      const offset = Number(r.addr(is64 ? o + 8 : o + 4, is64))
      const vaddr = r.addr(is64 ? o + 16 : o + 8, is64)
      const filesz = Number(r.addr(is64 ? o + 32 : o + 16, is64))
      const memsz = Number(r.addr(is64 ? o + 40 : o + 20, is64))
      if (pType === 3) details.push(['Interpreter', r.str(offset, filesz)])
      regions.push({
        kind: 'Segment',
        name: PT_TYPES[pType] ?? hex(pType),
        addr: vaddr,
        offset,
        size: filesz,
        memSize: memsz,
        flags: `${flags & 4 ? 'R' : '-'}${flags & 2 ? 'W' : '-'}${flags & 1 ? 'X' : '-'}`,
        entropy: regionEntropy(r, offset, filesz),
      })
    }
  })

  interface Shdr {
    name: number
    type: number
    flags: bigint
    addr: bigint
    offset: number
    size: number
    link: number
    entsize: number
  }
  const shdrs: Shdr[] = []
  guarded(warnings, 'section headers', () => {
    if (!shoff) return
    // More than 0xff00 sections: the real count lives in section 0's sh_size
    if (shnum === 0) shnum = Number(r.addr(shoff + (is64 ? 32 : 20), is64))
    for (let i = 0; i < shnum; i++) {
      const o = shoff + i * shentsize
      shdrs.push({
        name: r.u32(o),
        type: r.u32(o + 4),
        flags: r.addr(o + 8, is64),
        addr: r.addr(o + 8 + w, is64),
        offset: Number(r.addr(o + 8 + 2 * w, is64)),
        size: Number(r.addr(o + 8 + 3 * w, is64)),
        link: r.u32(o + 8 + 4 * w),
        entsize: Number(r.addr(o + 16 + 5 * w, is64)),
      })
    }
  })
  const names = shdrs[shstrndx]
  const nameOf = (s: Shdr) => {
    try {
      return names ? r.str(names.offset + s.name, 256) : ''
    } catch {
      return ''
    }
  }
  for (const [i, s] of shdrs.entries()) {
    if (i === 0 && s.type === 0) continue
    const nobits = s.type === 8
    const f = Number(s.flags & 0xffn)
    regions.push({
      kind: 'Section',
      name: nameOf(s),
      addr: s.addr,
      offset: s.offset,
      size: nobits ? 0 : s.size,
      memSize: s.flags & 2n ? s.size : 0,
      flags: `${f & 2 ? 'A' : ''}${f & 1 ? 'W' : ''}${f & 4 ? 'X' : ''}`,
      entropy: nobits ? null : regionEntropy(r, s.offset, s.size),
    })
  }

  // DT_NEEDED libraries and DT_SONAME
  guarded(warnings, 'dynamic section', () => {
    const dyn = shdrs.find((s) => s.type === 6)
    const strtab = dyn && shdrs[dyn.link]
    if (!dyn || !strtab) return
    const ent = is64 ? 16 : 8
    for (let o = dyn.offset; o + ent <= dyn.offset + dyn.size; o += ent) {
      const tag = Number(r.addr(o, is64))
      if (tag === 0) break
      const val = Number(r.addr(o + w, is64))
      if (tag === 1) libraries.push(r.str(strtab.offset + val))
      else if (tag === 14) details.push(['SONAME', r.str(strtab.offset + val)])
      else if (tag === 15 || tag === 29) details.push([tag === 15 ? 'RPATH' : 'RUNPATH', r.str(strtab.offset + val)])
    }
  })

  // Imports and exports: the dynamic symbol table, or the full symbol table for objects
  guarded(warnings, 'symbol table', () => {
    const symtab = shdrs.find((s) => s.type === 11) ?? shdrs.find((s) => s.type === 2)
    const strtab = symtab && shdrs[symtab.link]
    if (!symtab || !strtab) return
    const ent = symtab.entsize || (is64 ? 24 : 16)
    for (let o = symtab.offset + ent; o + ent <= symtab.offset + symtab.size; o += ent) {
      const name = r.str(strtab.offset + r.u32(o), 1024)
      const info = is64 ? r.u8(o + 4) : r.u8(o + 12)
      const shndx = is64 ? r.u16(o + 6) : r.u16(o + 14)
      const bind = info >> 4
      const stype = info & 0xf
      if (!name || (bind !== 1 && bind !== 2)) continue // global or weak only
      if (shndx === 0) imports.push({ name, library: '' })
      else if (stype <= 2 || stype === 10) exports.push({ name, addr: is64 ? r.u64(o + 8) : BigInt(r.u32(o + 4)) })
    }
  })
  if (warnings.length) details.push(['Warnings', warnings.join('; ')])

  return {
    format: 'ELF',
    type: ELF_TYPES[type] ?? hex(type),
    arch: ELF_MACHINES[machine] ?? `machine ${machine}`,
    bits: is64 ? 64 : 32,
    endian: r.le ? 'Little' : 'Big',
    entry: entry || null,
    details,
    regions,
    imports,
    exports,
    libraries,
  }
}

// ---------- PE ----------

const PE_MACHINES: Record<number, string> = {
  332: 'x86',
  34404: 'x86-64',
  448: 'ARM',
  452: 'ARMv7 Thumb-2',
  43620: 'ARM64',
  42561: 'ARM64EC',
  512: 'IA-64',
  20530: 'RISC-V 32',
  20580: 'RISC-V 64',
  25188: 'LoongArch 64',
}
const PE_SUBSYSTEMS: Record<number, string> = {
  1: 'Native',
  2: 'Windows GUI',
  3: 'Windows console',
  9: 'Windows CE',
  10: 'EFI application',
  11: 'EFI boot driver',
  12: 'EFI runtime driver',
  14: 'Xbox',
  16: 'Boot application',
}

function parsePe(bytes: Uint8Array): BinaryInfo {
  const r = new Reader(bytes, true)
  const pe = r.u32(0x3c)
  if (r.u32(pe) !== 0x4550) throw new Error('MZ file without a PE header (a DOS executable?)')
  const coff = pe + 4
  const machine = r.u16(coff)
  const nsections = r.u16(coff + 2)
  const timestamp = r.u32(coff + 4)
  const optSize = r.u16(coff + 16)
  const characteristics = r.u16(coff + 18)
  const opt = coff + 20
  const magic = r.u16(opt)
  if (magic !== 0x10b && magic !== 0x20b) throw new Error('Unknown PE optional header')
  const is64 = magic === 0x20b
  const entryRva = r.u32(opt + 16)
  const imageBase = is64 ? r.u64(opt + 24) : BigInt(r.u32(opt + 28))
  const subsystem = r.u16(opt + 68)
  const dllChars = r.u16(opt + 70)
  const ndirs = r.u32(opt + (is64 ? 108 : 92))
  const dirs = opt + (is64 ? 112 : 96)
  const dir = (i: number) =>
    i < ndirs ? { rva: r.u32(dirs + i * 8), size: r.u32(dirs + i * 8 + 4) } : { rva: 0, size: 0 }

  const details: [string, string][] = [
    ['Image base', hex(imageBase)],
    ['Subsystem', PE_SUBSYSTEMS[subsystem] ?? String(subsystem)],
    [
      'Security',
      [
        dllChars & 0x40 ? 'ASLR' : '',
        dllChars & 0x20 ? 'High-entropy VA' : '',
        dllChars & 0x100 ? 'DEP' : '',
        dllChars & 0x4000 ? 'CFG' : '',
        dllChars & 0x400 ? 'No SEH' : '',
      ]
        .filter(Boolean)
        .join(', ') || 'none',
    ],
  ]
  const warnings: string[] = []
  const regions: Region[] = []
  const sections: { va: number; vsize: number; raw: number; rawSize: number }[] = []
  for (let i = 0; i < nsections; i++) {
    const o = opt + optSize + i * 40
    const vsize = r.u32(o + 8)
    const va = r.u32(o + 12)
    const rawSize = r.u32(o + 16)
    const raw = r.u32(o + 20)
    const c = r.u32(o + 36)
    sections.push({ va, vsize, raw, rawSize })
    regions.push({
      kind: 'Section',
      name: r.str(o, 8),
      addr: imageBase + BigInt(va),
      offset: raw,
      size: rawSize,
      memSize: vsize,
      flags: `${c & 0x40000000 ? 'R' : '-'}${c & 0x80000000 ? 'W' : '-'}${c & 0x20000000 ? 'X' : '-'}`,
      entropy: regionEntropy(r, raw, rawSize),
    })
  }
  const off = (rva: number) => {
    const s = sections.find((s) => rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize))
    if (!s) throw new RangeError(`RVA ${hex(rva)} is outside every section`)
    return rva - s.va + s.raw
  }

  const libraries: string[] = []
  const imports: Import[] = []
  guarded(warnings, 'import table', () => {
    const { rva } = dir(1)
    if (!rva) return
    for (let d = off(rva); ; d += 20) {
      const lookup = r.u32(d) || r.u32(d + 16) // OriginalFirstThunk, else FirstThunk
      const nameRva = r.u32(d + 12)
      if (!lookup && !nameRva) break
      const library = r.str(off(nameRva), 256)
      libraries.push(library)
      for (let t = off(lookup); ; t += is64 ? 8 : 4) {
        const v = is64 ? r.u64(t) : BigInt(r.u32(t))
        if (!v) break
        const byOrdinal = is64 ? v >> 63n : v >> 31n
        const name = byOrdinal ? `#${Number(v & 0xffffn)}` : r.str(off(Number(v & 0x7fffffffn)) + 2, 512)
        imports.push({ name, library })
      }
    }
  })

  const exports: Export[] = []
  guarded(warnings, 'export table', () => {
    const { rva } = dir(0)
    if (!rva) return
    const e = off(rva)
    details.push(['Export name', r.str(off(r.u32(e + 12)), 256)])
    const nnames = r.u32(e + 24)
    const funcs = off(r.u32(e + 28))
    const names = off(r.u32(e + 32))
    const ords = off(r.u32(e + 36))
    for (let i = 0; i < nnames; i++) {
      const name = r.str(off(r.u32(names + i * 4)), 512)
      exports.push({ name, addr: imageBase + BigInt(r.u32(funcs + r.u16(ords + i * 2) * 4)) })
    }
  })

  if (dir(14).rva) details.push(['Runtime', '.NET (CLR header present)'])
  if (dir(4).size) details.push(['Signature', `Authenticode, ${dir(4).size} bytes`])
  if (warnings.length) details.push(['Warnings', warnings.join('; ')])

  return {
    format: 'PE',
    type: characteristics & 0x2000 ? 'DLL' : characteristics & 0x2 ? 'Executable' : 'Object',
    arch: PE_MACHINES[machine] ?? `machine ${hex(machine)}`,
    bits: is64 ? 64 : 32,
    endian: 'Little',
    entry: entryRva ? imageBase + BigInt(entryRva) : null,
    timestamp,
    details,
    regions,
    imports,
    exports,
    libraries,
  }
}

// ---------- Mach-O ----------

const MACHO_CPUS: Record<number, string> = {
  7: 'x86',
  16777223: 'x86-64',
  12: 'ARM',
  16777228: 'ARM64',
  33554444: 'ARM64_32',
  18: 'PowerPC',
  16777234: 'PowerPC64',
}
const MACHO_TYPES: Record<number, string> = {
  1: 'Object',
  2: 'Executable',
  4: 'Core dump',
  6: 'Dynamic library',
  7: 'Dynamic linker',
  8: 'Bundle',
  9: 'Dynamic library stub',
  10: 'Debug symbols (dSYM)',
  11: 'Kernel extension',
}

function parseFat(bytes: Uint8Array): BinaryInfo {
  const r = new Reader(bytes, false)
  const fat64 = r.u32(0) === 0xcafebabf
  const n = r.u32(4)
  const archs: { cpu: number; offset: number }[] = []
  for (let i = 0; i < n; i++) {
    const o = 8 + i * (fat64 ? 32 : 20)
    archs.push({ cpu: r.u32(o), offset: fat64 ? Number(r.u64(o + 8)) : r.u32(o + 8) })
  }
  if (!archs.length) throw new Error('Universal binary without architectures')
  // ponytail: shows the first slice only; add a slice picker if people need the others
  const list = archs.map((a) => MACHO_CPUS[a.cpu] ?? hex(a.cpu)).join(', ')
  return parseMachO(bytes, archs[0]!.offset, [['Universal binary', `${list} (showing the first)`]])
}

function parseMachO(bytes: Uint8Array, base: number, details: [string, string][]): BinaryInfo {
  const magic = new Reader(bytes, true, base).u32(0)
  const le = magic === 0xfeedface || magic === 0xfeedfacf
  const r = new Reader(bytes, le, base)
  const is64 = r.u32(0) === 0xfeedfacf
  const cpu = r.u32(4)
  const filetype = r.u32(12)
  const ncmds = r.u32(16)
  const w = is64 ? 8 : 4
  const warnings: string[] = []
  const regions: Region[] = []
  const libraries: string[] = []
  const imports: Import[] = []
  const exports: Export[] = []
  let textAddr = 0n
  let entryOff = null as bigint | null
  let symtab = null as { symoff: number; nsyms: number; stroff: number } | null
  const prot = (p: number) => `${p & 1 ? 'R' : '-'}${p & 2 ? 'W' : '-'}${p & 4 ? 'X' : '-'}`

  guarded(warnings, 'load commands', () => {
    let o = is64 ? 32 : 28
    for (let i = 0; i < ncmds; i++) {
      const cmd = r.u32(o)
      const size = r.u32(o + 4)
      if (size < 8) throw new RangeError('Bad load command size')
      if (cmd === 0x1 || cmd === 0x19) {
        const segname = r.str(o + 8, 16)
        const vmaddr = r.addr(o + 24, is64)
        const vmsize = Number(r.addr(o + 24 + w, is64))
        const fileoff = Number(r.addr(o + 24 + 2 * w, is64))
        const filesize = Number(r.addr(o + 24 + 3 * w, is64))
        const p = 24 + 4 * w
        const initprot = r.u32(o + p + 4)
        const nsects = r.u32(o + p + 8)
        if (segname === '__TEXT') textAddr = vmaddr
        regions.push({
          kind: 'Segment',
          name: segname,
          addr: vmaddr,
          offset: base + fileoff,
          size: filesize,
          memSize: vmsize,
          flags: prot(initprot),
          entropy: regionEntropy(r, fileoff, filesize),
        })
        for (let s = 0; s < nsects; s++) {
          const so = o + p + 16 + s * (is64 ? 80 : 68)
          const addr = r.addr(so + 32, is64)
          const ssize = Number(r.addr(so + 32 + w, is64))
          const offset = r.u32(so + 32 + 2 * w)
          const zerofill = [1, 12, 18].includes(r.u32(so + 48 + 2 * w) & 0xff)
          regions.push({
            kind: 'Section',
            name: `${r.str(so + 16, 16)},${r.str(so, 16)}`,
            addr,
            offset: base + offset,
            size: zerofill ? 0 : ssize,
            memSize: ssize,
            flags: prot(initprot),
            entropy: zerofill ? null : regionEntropy(r, offset, ssize),
          })
        }
      } else if ([0xc, 0x80000018, 0x8000001f, 0x20, 0x80000023].includes(cmd)) {
        libraries.push(r.str(o + r.u32(o + 8), size))
      } else if (cmd === 0xd) details.push(['Install name', r.str(o + r.u32(o + 8), size)])
      else if (cmd === 0x80000028) entryOff = r.u64(o + 8)
      else if (cmd === 0x1b) {
        const id = Array.from(r.region(o + 8, 16), (b) => b.toString(16).padStart(2, '0')).join('')
        details.push(['UUID', id.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-').toUpperCase()])
      } else if (cmd === 0x2) symtab = { symoff: r.u32(o + 8), nsyms: r.u32(o + 12), stroff: r.u32(o + 16) }
      o += size
    }
  })

  guarded(warnings, 'symbol table', () => {
    if (!symtab) return
    const ent = is64 ? 16 : 12
    for (let i = 0; i < symtab.nsyms; i++) {
      const o = symtab.symoff + i * ent
      const type = r.u8(o + 4)
      if (type & 0xe0 || !(type & 1)) continue // debug (stab) entries and non-external symbols
      const name = r.str(symtab.stroff + r.u32(o), 1024)
      if ((type & 0xe) === 0) {
        // Two-level namespace: the high byte of n_desc is the 1-based library ordinal
        const ord = r.u16(o + 6) >> 8
        imports.push({ name, library: libraries[ord - 1] ?? '' })
      } else if ((type & 0xe) === 0xe) exports.push({ name, addr: r.addr(o + 8, is64) })
    }
  })
  if (warnings.length) details.push(['Warnings', warnings.join('; ')])

  return {
    format: 'Mach-O',
    type: MACHO_TYPES[filetype] ?? hex(filetype),
    arch: MACHO_CPUS[cpu] ?? hex(cpu),
    bits: is64 ? 64 : 32,
    endian: le ? 'Little' : 'Big',
    entry: entryOff === null ? null : textAddr + entryOff,
    details,
    regions,
    imports,
    exports,
    libraries,
  }
}

// ---------- Strings ----------

export interface FoundString {
  offset: number
  encoding: 'ASCII' | 'UTF-16LE'
  text: string
}

const printable = (b: number) => (b >= 0x20 && b < 0x7f) || b === 9
const latin1 = new TextDecoder('latin1')
const utf16 = new TextDecoder('utf-16le')

/** Printable ASCII and UTF-16LE runs of at least `min` characters, sorted by offset, capped at `limit`. */
export function findStrings(b: Uint8Array, min: number, limit = 200_000) {
  const out: FoundString[] = []
  let truncated = false
  const push = (s: FoundString) => {
    if (out.length < limit) out.push(s)
    else truncated = true
  }
  let start = -1
  for (let i = 0; i <= b.length; i++) {
    if (i < b.length && printable(b[i]!)) {
      if (start < 0) start = i
    } else if (start >= 0) {
      if (i - start >= min) push({ offset: start, encoding: 'ASCII', text: latin1.decode(b.subarray(start, i)) })
      start = -1
    }
  }
  for (const parity of [0, 1]) {
    start = -1
    for (let i = parity; i <= b.length; i += 2) {
      if (i + 1 < b.length && printable(b[i]!) && b[i + 1] === 0) {
        if (start < 0) start = i
      } else if (start >= 0) {
        if ((i - start) / 2 >= min)
          push({ offset: start, encoding: 'UTF-16LE', text: utf16.decode(b.subarray(start, i)) })
        start = -1
      }
    }
  }
  out.sort((x, y) => x.offset - y.offset)
  return { strings: out, truncated }
}
