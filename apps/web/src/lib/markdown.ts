import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import { Marked, type Token, type Tokens } from 'marked'

export interface TocEntry {
  depth: number
  text: string
  id: string
  /** 1-based source line; missing for headings nested in lists or quotes */
  line?: number
}

type LinedHeading = Tokens.Heading & { line?: number }

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const plain = (tokens: Token[]): string =>
  tokens.map((t) => ('tokens' in t && t.tokens ? plain(t.tokens) : 'text' in t ? t.text : t.raw)).join('')

// Links in a note open in a new tab instead of navigating away from the editor
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') ?? '')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * GitHub-flavoured markdown to sanitized HTML plus a table of contents. Fenced code is syntax highlighted,
 * ```mermaid blocks become <pre class="mermaid">, and top-level blocks get data-line="<source line>".
 */
export function renderMarkdown(source: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = []
  const seen = new Map<string, number>()
  const slug = (text: string) => {
    const base =
      text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-') || 'section'
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n ? `${base}-${n}` : base
  }

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(token) {
        const text = plain(token.tokens)
        const id = slug(text)
        toc.push({ depth: token.depth, text, id, line: (token as LinedHeading).line })
        return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`
      },
      code({ text, lang }) {
        const name = lang?.trim().split(/\s+/)[0]
        if (name === 'mermaid') return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`
        const language = name && hljs.getLanguage(name) ? name : undefined
        const body = language ? hljs.highlight(text, { language, ignoreIllegals: true }).value : escapeHtml(text)
        return `<pre><code class="hljs${language ? ` language-${language}` : ''}">${body}</code></pre>\n`
      },
    },
  })

  const tokens = marked.lexer(source.replace(/\r\n?/g, '\n'))
  // Render block by block so each top-level element can carry its source line (data-line), used for scroll sync
  let line = 1
  const html = tokens.map((t) => {
    if (t.type === 'heading') (t as LinedHeading).line = line
    const out = marked.parser([t]).replace(/^<([a-z][a-z0-9]*)/i, `<$1 data-line="${line}"`)
    line += t.raw.split('\n').length - 1
    return out
  })
  return { html: DOMPurify.sanitize(html.join('')), toc }
}

/**
 * Piecewise-linear lookup: maps x to y through points sorted by x (y must not decrease).
 * Used to map an editor line to a preview offset and back.
 */
export function interpolate(points: [number, number][], x: number): number {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1] as [number, number]
    const [x1, y1] = points[i] as [number, number]
    if (x < x1 || i === points.length - 1)
      return x1 === x0 ? y0 : y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
  }
  return points[0]?.[1] ?? 0
}
