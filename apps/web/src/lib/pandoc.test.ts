import { describe, expect, it } from 'vitest'
import { ACCEPT, baseName, formatForFile, INPUT_FORMATS, OUTPUT_FORMATS, pandocOptions } from './pandoc'

const s = { from: 'markdown', to: 'html', standalone: false, toc: false }

describe('formatForFile', () => {
  it('picks the input format by extension, case-insensitively', () => {
    expect(formatForFile('notes.MD')?.id).toBe('markdown')
    expect(formatForFile('paper.tex')?.id).toBe('latex')
    expect(formatForFile('report.final.docx')).toMatchObject({ id: 'docx', binary: true })
    expect(formatForFile('book.epub')?.id).toBe('epub')
    expect(formatForFile('analysis.ipynb')?.id).toBe('ipynb')
  })
  it('returns undefined for unknown or missing extensions', () => {
    expect(formatForFile('archive.zip')).toBeUndefined()
    expect(formatForFile('README')).toBeUndefined()
  })
})

describe('pandocOptions', () => {
  it('converts text to text through stdin/stdout', () => {
    expect(pandocOptions(s, false)).toEqual({ from: 'markdown', to: 'html' })
  })
  it('reads binary input from a file and writes binary output to a file', () => {
    expect(pandocOptions({ ...s, from: 'docx', to: 'odt' }, true)).toEqual({
      from: 'docx',
      to: 'odt',
      'input-files': ['input.docx'],
      'output-file': 'output.odt',
    })
  })
  it('adds a table of contents only to standalone or binary documents', () => {
    expect(pandocOptions({ ...s, toc: true }, false)).not.toHaveProperty('table-of-contents')
    expect(pandocOptions({ ...s, toc: true, standalone: true }, false)).toMatchObject({
      standalone: true,
      'table-of-contents': true,
    })
    expect(pandocOptions({ ...s, to: 'docx', toc: true }, false)).toMatchObject({ 'table-of-contents': true })
  })
})

it('lists unique format ids and accepts every input extension', () => {
  for (const list of [INPUT_FORMATS, OUTPUT_FORMATS]) expect(new Set(list.map((f) => f.id)).size).toBe(list.length)
  expect(ACCEPT.split(',')).toContain('.docx')
  expect(baseName('a.b.docx')).toBe('a.b')
})
