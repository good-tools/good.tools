import { describe, expect, it } from 'vitest'
import config from '@/assets/models/magika/config.min.json'
import { type ContentTypeInfo, extensionOf, hexRows, magikaFeatures, matchSignature, verdict } from './file-identifier'

const bytes = (s: string) => new TextEncoder().encode(s)
const hex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (b) => Number.parseInt(b, 16))
const type = (label: string, extensions: string[], group = 'document', is_text = false): ContentTypeInfo => ({
  label,
  description: label.toUpperCase(),
  mime_type: null,
  group,
  extensions,
  is_text,
})

describe('magikaFeatures', () => {
  it('strips leading whitespace from the start block and trailing from the end block, pads the start block at the end and the end block at the start', () => {
    const data = bytes('  \nhello world\n\t ')
    const f = magikaFeatures(data, data, config)
    const pad = config.padding_token
    expect(f).toHaveLength(2048)
    expect(Array.from(f.slice(0, 15))).toEqual([...bytes('hello world\n\t '), pad])
    expect(Array.from(f.slice(2048 - 17))).toEqual([pad, pad, pad, ...bytes('  \nhello world')])
  })

  it('takes at most beg_size / end_size bytes from a block', () => {
    const data = new Uint8Array(5000).fill(65)
    const f = magikaFeatures(data.subarray(0, 4096), data.subarray(5000 - 4096), config)
    expect(f.every((b) => b === 65)).toBe(true)
  })
})

describe('matchSignature', () => {
  it('recognises common formats', () => {
    expect(matchSignature(bytes('%PDF-1.7'))?.name).toBe('PDF document')
    expect(matchSignature(hex('504b030414000000'))?.name).toBe('ZIP archive')
    expect(matchSignature(hex('4d5a90000300'))?.executable).toBe(true)
    expect(matchSignature(hex('52494646aaaaaaaa57454250'))?.name).toBe('WebP image')
    expect(matchSignature(hex('0000001866747970'))?.exts).toContain('mp4')
  })

  it('checks offsets and returns null for plain text', () => {
    const tar = new Uint8Array(300)
    tar.set(bytes('ustar'), 257)
    expect(matchSignature(tar)?.name).toBe('TAR archive')
    expect(matchSignature(bytes('hello'))).toBeNull()
  })
})

describe('extensionOf', () => {
  it('handles dotfiles and paths', () => {
    expect(extensionOf('Report.PDF')).toBe('pdf')
    expect(extensionOf('archive.tar.gz')).toBe('gz')
    expect(extensionOf('.bashrc')).toBe('')
    expect(extensionOf('Makefile')).toBe('')
  })
})

describe('verdict', () => {
  const pdf = type('pdf', ['pdf'])
  const pe = type('pebin', ['exe', 'dll'], 'executable')
  const zip = matchSignature(hex('504b0304'))
  const mz = matchSignature(hex('4d5a'))

  it('matches when content agrees with the name', () => {
    expect(verdict('pdf', pdf, matchSignature(bytes('%PDF'))).status).toBe('match')
    expect(verdict('docx', type('docx', ['docx']), zip).status).toBe('match')
  })

  it('flags a .pdf that is really a ZIP as a mismatch', () => {
    expect(verdict('pdf', type('zip', ['zip'], 'archive'), zip)).toEqual({
      status: 'mismatch',
      reason: 'Named .pdf but content is ZIP archive',
    })
  })

  it('flags a disguised executable as danger, by signature or by Magika alone', () => {
    expect(verdict('pdf', pe, mz).status).toBe('danger')
    expect(verdict('jpg', pe, null).status).toBe('danger')
    expect(verdict('exe', type('elf', ['elf'], 'executable'), null).status).toBe('mismatch')
  })

  it('never lets Magika overrule executable magic bytes', () => {
    expect(verdict('pdf', pdf, mz).status).toBe('danger')
  })

  it('is lenient with overlapping text formats and unknown content', () => {
    expect(verdict('txt', type('markdown', ['md'], 'text', true), null).status).toBe('unknown')
    expect(verdict('bin', type('unknown', []), null).status).toBe('unknown')
    expect(verdict('', pdf, null).status).toBe('unknown')
  })
})

describe('hexRows', () => {
  it('formats offset, hex and printable ASCII', () => {
    expect(hexRows(bytes('%PDF\n'))).toEqual([['00000000', '25 50 44 46 0a', '%PDF.']])
    expect(hexRows(new Uint8Array(17))).toHaveLength(2)
  })
})
