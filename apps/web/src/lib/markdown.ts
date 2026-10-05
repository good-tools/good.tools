import DOMPurify from 'dompurify'
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

/** GitHub-flavoured markdown to sanitized HTML plus a table of contents. ```mermaid blocks become <pre class="mermaid">. */
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
        return lang === 'mermaid' ? `<pre class="mermaid">${escapeHtml(text)}</pre>\n` : false
      },
    },
  })

  const tokens = marked.lexer(source.replace(/\r\n?/g, '\n'))
  let line = 1
  for (const t of tokens) {
    if (t.type === 'heading') (t as LinedHeading).line = line
    line += t.raw.split('\n').length - 1
  }
  return { html: DOMPurify.sanitize(marked.parser(tokens)), toc }
}
