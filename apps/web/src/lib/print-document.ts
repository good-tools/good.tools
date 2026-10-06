import interItalic from '@fontsource-variable/inter/files/inter-latin-wght-italic.woff2?url'
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'
import styles from '@/assets/styles/print-document.css?raw'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** A standalone, always-light HTML document for printing rendered (already sanitized) markdown. */
export function printableHtml(title: string, body: string, origin = location.origin): string {
  const font = (family: string, url: string, style = 'normal') =>
    `@font-face{font-family:'${family}';src:url('${new URL(url, origin)}') format('woff2');font-weight:100 900;font-style:${style};font-display:block}`
  // The running title goes in the page footer; CSS strings need quotes, backslashes and newlines escaped
  const footer = `@page{@bottom-left{content:"${title.replace(/["\\]/g, '\\$&').replace(/\s+/g, ' ')}"}}`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${[
    font('Inter', inter),
    font('Inter', interItalic, 'italic'),
    font('JetBrains Mono', mono),
    styles,
    footer,
  ].join('\n')}</style></head><body><main class="doc">${body}</main></body></html>`
}

/**
 * Prints body html through a hidden iframe so the browser's "Save as PDF" gets selectable text, real fonts
 * and links. Waits for fonts and images first; the title becomes the default PDF file name.
 */
export async function printDocument(title: string, body: string): Promise<void> {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  frame.srcdoc = printableHtml(title, body)
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  document.body.append(frame)
  await loaded
  const win = frame.contentWindow as Window
  const doc = win.document
  for (const pre of doc.querySelectorAll('pre:not(.mermaid)'))
    if ((pre.textContent ?? '').split('\n').length > 40) pre.classList.add('long')
  await doc.fonts.ready
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)))

  // Some browsers name the PDF after the top-level page rather than the iframe
  const pageTitle = document.title
  document.title = title
  const done = () => {
    document.title = pageTitle
    frame.remove()
  }
  win.addEventListener('afterprint', done, { once: true })
  win.focus()
  win.print()
}
