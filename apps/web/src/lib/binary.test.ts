// @vitest-environment node
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { entropy, findStrings, parseBinary, parseOffset } from './binary'

// Tiny "hello" builds: gcc for ELF, zig cc for PE (x86-64 exe, x86 dll) and Mach-O (arm64)
const load = (name: string) => gunzipSync(readFileSync(new URL(`./__fixtures__/binary/${name}.gz`, import.meta.url)))
const section = (info: ReturnType<typeof parseBinary>, name: string) =>
  info.regions.find((r) => r.kind === 'Section' && r.name === name)

describe('parseBinary', () => {
  it('reads a dynamically linked ELF executable', () => {
    const info = parseBinary(load('hello.elf'))
    expect(info).toMatchObject({ format: 'ELF', arch: 'x86-64', bits: 64, endian: 'Little', entry: 0x10c0n })
    expect(info.libraries).toEqual(['libc.so.6'])
    expect(info.imports.map((i) => i.name)).toEqual(
      expect.arrayContaining(['__libc_start_main', 'strlen', '__printf_chk']),
    )
    expect(info.details).toContainEqual(['Interpreter', '/lib64/ld-linux-x86-64.so.2'])
    expect(section(info, '.text')).toMatchObject({ addr: 0x1080n, size: 305, flags: 'AX' })
    expect(section(info, '.text')!.entropy).toBeCloseTo(5.217, 2)
    expect(section(info, '.bss')).toMatchObject({ size: 0, entropy: null })
    expect(info.regions.find((r) => r.name === 'INTERP')).toMatchObject({ kind: 'Segment', flags: 'R--' })
  })

  it('lists ELF shared object exports and object file symbols', () => {
    const so = parseBinary(load('libhello.so'))
    expect(so.exports).toEqual(
      expect.arrayContaining([
        { name: 'answer', addr: 0x1199n },
        { name: 'main', addr: 0x10a0n },
      ]),
    )
    const obj = parseBinary(load('hello.o'))
    expect(obj.type).toBe('Relocatable object')
    expect(obj.entry).toBeNull()
    expect(obj.exports.map((e) => e.name)).toEqual(expect.arrayContaining(['answer', 'main', 'greeting']))
    expect(obj.imports.map((e) => e.name)).toEqual(expect.arrayContaining(['__printf_chk', 'strlen']))
  })

  it('reads a PE32+ executable', () => {
    const info = parseBinary(load('hello.exe'))
    expect(info).toMatchObject({ format: 'PE', type: 'Executable', arch: 'x86-64', bits: 64, entry: 0x140001035n })
    expect(info.timestamp).toBe(3027119509)
    expect(info.libraries).toEqual(['KERNEL32.dll'])
    expect(info.imports).toEqual([
      { name: 'ExitProcess', library: 'KERNEL32.dll' },
      { name: 'GetTickCount', library: 'KERNEL32.dll' },
    ])
    expect(info.details).toContainEqual(['Subsystem', 'Windows console'])
    expect(section(info, '.text')).toMatchObject({ addr: 0x140001000n, flags: 'R-X' })
  })

  it('reads a PE32 DLL with exports', () => {
    const info = parseBinary(load('hello32.dll'))
    expect(info).toMatchObject({ format: 'PE', type: 'DLL', arch: 'x86', bits: 32, entry: 0x1000101dn })
    expect(info.exports).toEqual([
      { name: 'answer', addr: 0x10001000n },
      { name: 'greet', addr: 0x10001013n },
    ])
    expect(info.details).toContainEqual(['Export name', 'hello32.dll'])
  })

  it('reads a Mach-O executable', () => {
    const info = parseBinary(load('hello.macho'))
    expect(info).toMatchObject({ format: 'Mach-O', type: 'Executable', arch: 'ARM64', bits: 64, entry: 0x1000015d8n })
    expect(info.libraries).toEqual(['/usr/lib/libSystem.B.dylib'])
    expect(info.imports).toContainEqual({ name: '_printf', library: '/usr/lib/libSystem.B.dylib' })
    expect(info.exports).toContainEqual({ name: '_main', addr: 0x1000015d8n })
    expect(section(info, '__TEXT,__text')).toMatchObject({ addr: 0x1000015d8n, size: 96, flags: 'R-X' })
    expect(info.regions.find((r) => r.name === '__PAGEZERO')).toMatchObject({ kind: 'Segment', entropy: null })
  })

  it('reads the first slice of a universal Mach-O', () => {
    const slice = load('hello.macho')
    const fat = new Uint8Array(4096 + slice.length)
    const v = new DataView(fat.buffer)
    v.setUint32(0, 0xcafebabe)
    v.setUint32(4, 1)
    v.setUint32(8, 0x100000c)
    v.setUint32(16, 4096)
    v.setUint32(20, slice.length)
    fat.set(slice, 4096)
    const info = parseBinary(fat)
    expect(info.details[0]).toEqual(['Universal binary', 'ARM64 (showing the first)'])
    expect(section(info, '__TEXT,__text')!.offset).toBe(section(parseBinary(slice), '__TEXT,__text')!.offset + 4096)
  })

  it('rejects other files', () => {
    expect(() => parseBinary(new TextEncoder().encode('not a binary '.repeat(10)))).toThrow(/Not an ELF/)
    expect(() => parseBinary(new Uint8Array(8))).toThrow(/too small/)
  })
})

describe('entropy', () => {
  it('is 0 for constant data and 8 for uniform bytes', () => {
    expect(entropy(new Uint8Array(100))).toBe(0)
    expect(entropy(Uint8Array.from({ length: 256 }, (_, i) => i))).toBe(8)
  })
})

describe('findStrings', () => {
  it('finds ASCII and UTF-16LE runs with offsets', () => {
    const b = new Uint8Array([
      0,
      ...new TextEncoder().encode('hello'),
      0,
      1,
      0x61,
      0,
      0x62,
      0,
      0x63,
      0,
      0x64,
      0,
      2,
      0x61,
    ])
    expect(findStrings(b, 4).strings).toEqual([
      { offset: 1, encoding: 'ASCII', text: 'hello' },
      { offset: 8, encoding: 'UTF-16LE', text: 'abcd' },
    ])
    expect(findStrings(b, 6).strings).toEqual([])
    expect(findStrings(b, 4, 1)).toMatchObject({ truncated: true, strings: [{ text: 'hello' }] })
  })
})

describe('parseOffset', () => {
  it('reads decimal, 0x hex and bare hex with letters', () => {
    expect(parseOffset('4096')).toBe(4096)
    expect(parseOffset(' 0x1000 ')).toBe(4096)
    expect(parseOffset('ff')).toBe(255)
    expect(parseOffset('-1')).toBeNull()
    expect(parseOffset('0xzz')).toBeNull()
  })
})
