/** Formats and options for the Document Converter (pandoc). */

export interface Format {
  id: string
  label: string
  /** File extensions, first is the one used for output */
  ext: string[]
  /** Zip-based or otherwise not text: read from / written to a file, not the text panes */
  binary?: boolean
}

export const INPUT_FORMATS: Format[] = [
  { id: 'markdown', label: 'Markdown (pandoc)', ext: ['md', 'markdown', 'mdown', 'mkd'] },
  { id: 'gfm', label: 'Markdown (GitHub)', ext: [] },
  { id: 'commonmark', label: 'CommonMark', ext: [] },
  { id: 'html', label: 'HTML', ext: ['html', 'htm', 'xhtml'] },
  { id: 'latex', label: 'LaTeX', ext: ['tex', 'latex', 'ltx'] },
  { id: 'rst', label: 'reStructuredText', ext: ['rst'] },
  { id: 'org', label: 'Org', ext: ['org'] },
  { id: 'asciidoc', label: 'AsciiDoc', ext: ['adoc', 'asciidoc'] },
  { id: 'mediawiki', label: 'MediaWiki', ext: ['wiki', 'mediawiki'] },
  { id: 'textile', label: 'Textile', ext: ['textile'] },
  { id: 'typst', label: 'Typst', ext: ['typ'] },
  { id: 'docbook', label: 'DocBook', ext: ['dbk', 'docbook'] },
  { id: 'jats', label: 'JATS', ext: ['jats'] },
  { id: 'rtf', label: 'RTF', ext: ['rtf'] },
  { id: 'ipynb', label: 'Jupyter notebook', ext: ['ipynb'] },
  { id: 'csv', label: 'CSV', ext: ['csv'] },
  { id: 'tsv', label: 'TSV', ext: ['tsv'] },
  { id: 'man', label: 'Man page', ext: ['man'] },
  { id: 'docx', label: 'Word (DOCX)', ext: ['docx'], binary: true },
  { id: 'odt', label: 'OpenDocument (ODT)', ext: ['odt'], binary: true },
  { id: 'epub', label: 'EPUB', ext: ['epub'], binary: true },
  { id: 'pptx', label: 'PowerPoint (PPTX)', ext: ['pptx'], binary: true },
  { id: 'xlsx', label: 'Excel (XLSX)', ext: ['xlsx'], binary: true },
]

export const OUTPUT_FORMATS: Format[] = [
  { id: 'markdown', label: 'Markdown (pandoc)', ext: ['md'] },
  { id: 'gfm', label: 'Markdown (GitHub)', ext: ['md'] },
  { id: 'commonmark', label: 'CommonMark', ext: ['md'] },
  { id: 'markdown_strict', label: 'Markdown (original)', ext: ['md'] },
  { id: 'html', label: 'HTML', ext: ['html'] },
  { id: 'latex', label: 'LaTeX', ext: ['tex'] },
  { id: 'rst', label: 'reStructuredText', ext: ['rst'] },
  { id: 'org', label: 'Org', ext: ['org'] },
  { id: 'asciidoc', label: 'AsciiDoc', ext: ['adoc'] },
  { id: 'mediawiki', label: 'MediaWiki', ext: ['wiki'] },
  { id: 'textile', label: 'Textile', ext: ['textile'] },
  { id: 'typst', label: 'Typst', ext: ['typ'] },
  { id: 'docbook', label: 'DocBook', ext: ['xml'] },
  { id: 'jats', label: 'JATS', ext: ['xml'] },
  { id: 'rtf', label: 'RTF', ext: ['rtf'] },
  { id: 'ipynb', label: 'Jupyter notebook', ext: ['ipynb'] },
  { id: 'man', label: 'Man page', ext: ['1'] },
  { id: 'plain', label: 'Plain text', ext: ['txt'] },
  { id: 'docx', label: 'Word (DOCX)', ext: ['docx'], binary: true },
  { id: 'odt', label: 'OpenDocument (ODT)', ext: ['odt'], binary: true },
  { id: 'epub', label: 'EPUB', ext: ['epub'], binary: true },
  { id: 'pptx', label: 'PowerPoint (PPTX)', ext: ['pptx'], binary: true },
]

export const ACCEPT = INPUT_FORMATS.flatMap((f) => f.ext.map((e) => `.${e}`)).join(',')

const find = (list: Format[], id: string) => list.find((f) => f.id === id)
export const inputFormat = (id: string) => find(INPUT_FORMATS, id)
export const outputFormat = (id: string) => find(OUTPUT_FORMATS, id)

/** Input format for a file name, by extension; undefined when unknown. */
export function formatForFile(name: string): Format | undefined {
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext || !name.includes('.')) return undefined
  return INPUT_FORMATS.find((f) => f.ext.includes(ext))
}

export interface ConvertSettings {
  from: string
  to: string
  standalone: boolean
  toc: boolean
}

/** File names inside pandoc's virtual file system */
export const INPUT_FILE = 'input'
export const OUTPUT_FILE = 'output'

/** pandoc options (defaults-file format) for a conversion; binary input is read from INPUT_FILE. */
export function pandocOptions(s: ConvertSettings, binaryInput: boolean): Record<string, unknown> {
  const out = outputFormat(s.to)
  const opts: Record<string, unknown> = { from: s.from, to: s.to }
  if (binaryInput) opts['input-files'] = [`${INPUT_FILE}.${inputFormat(s.from)?.ext[0] ?? 'bin'}`]
  if (out?.binary) opts['output-file'] = `${OUTPUT_FILE}.${out.ext[0]}`
  // Binary formats are always complete documents
  if (s.standalone && !out?.binary) opts.standalone = true
  // A table of contents needs a standalone document (except in binary formats, which always are)
  if (s.toc && (s.standalone || out?.binary)) opts['table-of-contents'] = true
  return opts
}

/** "report.final.docx" → "report.final" */
export const baseName = (name: string) => name.replace(/\.[^.]*$/, '') || 'document'
