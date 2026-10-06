/** Why a file can't be converted, or null when it looks like a Word document we can render. */
export function rejectReason(name: string, head: Uint8Array): string | null {
  const ext = name.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? ''
  if (ext === 'doc') return 'Old .doc files (Word 97–2003) are not supported. Open it in Word and save it as .docx.'
  if (ext === 'odt' || ext === 'rtf' || ext === 'pages')
    return `.${ext} files are not supported. Open it in Word, LibreOffice or Pages and save it as .docx.`
  if (!['docx', 'docm', 'dotx', 'dotm'].includes(ext)) return `${name} is not a Word document (.docx)`
  // .docx is a ZIP archive
  if (head[0] !== 0x50 || head[1] !== 0x4b) return `${name} is not a valid .docx file`
  return null
}

export interface PageBox {
  /** CSS lengths as docx-preview writes them, e.g. "595.3pt" */
  width: string
  height: string
}

/**
 * Print stylesheet that makes each rendered page one sheet of its own size. Pages keep their margins as
 * padding, cloned onto every sheet when a page's content runs longer than the paper.
 * Each page needs `--page-h` set to its paper height (so it fills the sheet without spilling onto a blank one).
 * Returns the CSS and, per page, the `@page` name to set on it (mixed portrait/landscape sections need one each).
 */
export function printCss(pages: PageBox[]): { css: string; names: string[] } {
  const sizes = [...new Set(pages.filter((p) => p.width && p.height).map((p) => `${p.width} ${p.height}`))]
  const names = pages.map((p) => (p.width && p.height ? `p${sizes.indexOf(`${p.width} ${p.height}`)}` : ''))
  const css = [
    '@page { margin: 0 }',
    ...sizes.map((s, i) => `@page p${i} { size: ${s}; margin: 0 }`),
    `@media print {
  html, body { background: none !important; margin: 0 !important; padding: 0 !important }
  .docx-wrapper { display: block !important; padding: 0 !important; background: none !important; zoom: 1 !important }
  .docx-wrapper > section.docx { margin: 0 !important; box-shadow: none !important; overflow: visible !important;
    box-decoration-break: clone; break-after: page;
    min-height: calc(var(--page-h, 0px) - 2px) !important; print-color-adjust: exact; -webkit-print-color-adjust: exact }
  .docx-wrapper > section.docx:last-child { break-after: auto }
}`,
  ].join('\n')
  return { css, names }
}
