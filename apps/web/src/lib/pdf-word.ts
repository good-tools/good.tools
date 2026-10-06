/** A run of text from pdf.js (or OCR), in points with y growing downwards from the top of the page. */
export interface TextItem {
  str: string
  x: number
  /** Baseline */
  y: number
  width: number
  /** Font size */
  size: number
  bold?: boolean
  italic?: boolean
}

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  /** Starts on a new line (a line break, not a new paragraph) */
  newLine?: boolean
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; runs: Run[]; y: number }
  | { kind: 'paragraph'; runs: Run[]; y: number }
  | { kind: 'list'; numbered: boolean; runs: Run[]; y: number }
  | { kind: 'image'; index: number; y: number }

export interface PageImage {
  /** Position on the page, points from the top-left */
  x: number
  y: number
  width: number
  height: number
}

export interface PageInput {
  width: number
  height: number
  items: TextItem[]
  images: PageImage[]
  /** Text from OCR, whose sizes are line heights rather than font sizes */
  ocr?: boolean
}

interface Line {
  items: TextItem[]
  x: number
  right: number
  y: number
  size: number
}

const BULLET = /^([•●▪■◦‣○·∙]\s*|[*–-]\s+)/
const NUMBERED = /^\(?(\d{1,3}|[a-z])[.)]\s+/

/** Groups items into lines: a new line starts when the baseline moves by more than half the font size. */
export function toLines(items: TextItem[]): Line[] {
  const lines: Line[] = []
  for (const it of items) {
    if (!it.str) continue
    const last = lines.at(-1)
    if (last && Math.abs(it.y - last.y) < Math.max(it.size, last.size) * 0.5 && it.x >= last.right - it.size) {
      last.items.push(it)
      last.right = Math.max(last.right, it.x + it.width)
      last.size = Math.max(last.size, it.str.trim() ? it.size : 0)
    } else if (it.str.trim()) lines.push({ items: [it], x: it.x, right: it.x + it.width, y: it.y, size: it.size })
  }
  return lines
}

/** A line's text as runs, merging items with the same style and adding spaces where pdf.js left gaps. */
function lineRuns(line: Line): Run[] {
  const runs: Run[] = []
  let prev: TextItem | undefined
  for (const it of line.items) {
    let text = it.str
    if (prev && !/\s$/.test(prev.str) && !/^\s/.test(text) && it.x - (prev.x + prev.width) > it.size * 0.15)
      text = ` ${text}`
    const last = runs.at(-1)
    if (last && !!last.bold === !!it.bold && !!last.italic === !!it.italic) last.text += text
    else runs.push({ text, ...(it.bold && { bold: true }), ...(it.italic && { italic: true }) })
    prev = it
  }
  const first = runs[0]
  if (first) first.text = first.text.trimStart()
  const end = runs.at(-1)
  if (end) end.text = end.text.trimEnd()
  return runs.filter((r) => r.text)
}

const textOf = (runs: Run[]) => runs.map((r) => r.text).join('')

/** The most common font size, weighted by characters: the body text size. */
export function bodySize(items: TextItem[]): number {
  const weight = new Map<number, number>()
  for (const it of items) {
    const s = Math.round(it.size * 2) / 2
    weight.set(s, (weight.get(s) ?? 0) + it.str.trim().length)
  }
  let best = 12
  let max = 0
  for (const [s, w] of weight) if (w > max) [best, max] = [s, w]
  return best
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)]! : 0
}

/** Removes a list marker from the start of the runs; numbered markers stay as text. */
function stripBullet(runs: Run[]): Run[] {
  const [first, ...rest] = runs
  if (!first) return runs
  return [{ ...first, text: first.text.replace(BULLET, '') }, ...rest].filter((r) => r.text)
}

/**
 * Rebuilds paragraphs, headings and lists from positioned text, page by page.
 * Headings are lines noticeably larger than the body text, ranked by size into up to three levels.
 * Lines inside a paragraph are joined when they wrap and kept as line breaks when they end short.
 * Images are placed between blocks by their vertical position.
 */
export function reconstruct(input: PageInput[]): Block[][] {
  const typed = input.filter((p) => !p.ocr)
  const body = bodySize((typed.length ? typed : input).flatMap((p) => p.items))
  // Scale each OCR page so its body text matches the rest; its headings keep their relative size
  const pages = input.map((p) => {
    if (!p.ocr) return p
    const f = body / bodySize(p.items)
    return { ...p, items: p.items.map((i) => ({ ...i, size: i.size * f })) }
  })
  const headingSizes = [
    ...new Set(
      pages
        .flatMap((p) => toLines(p.items))
        .filter((l) => l.size >= body * 1.15)
        .map((l) => Math.round(l.size)),
    ),
  ].sort((a, b) => b - a)
  const levelOf = (size: number) => Math.min(3, headingSizes.indexOf(Math.round(size)) + 1) as 1 | 2 | 3

  return pages.map((page) => {
    const lines = toLines(page.items)
    // Typical distance between baselines of body text, for telling paragraph gaps from line spacing
    const steps = lines
      .slice(1)
      .map((l, i) => l.y - lines[i]!.y)
      .filter(
        (d, i) =>
          d > 0 && Math.abs(lines[i + 1]!.size - body) < body * 0.1 && Math.abs(lines[i]!.size - body) < body * 0.1,
      )
    const step = Math.min(Math.max(median(steps) || body * 1.2, body), body * 2.2)
    const right = Math.max(...lines.map((l) => l.right))

    const blocks: Block[] = []
    let current: (Block & { runs: Run[] }) | undefined
    let prev: Line | undefined
    let indent = 0
    for (const line of lines) {
      const runs = lineRuns(line)
      const text = textOf(runs)
      const heading = line.size >= body * 1.15
      const bullet = BULLET.test(text) && text.length > 2
      const numbered = !bullet && NUMBERED.test(text)
      const gap = prev ? line.y - prev.y : 0
      const prevShort = !!prev && prev.right < right - body * 4
      const sameBlock =
        current &&
        prev &&
        !bullet &&
        !numbered &&
        gap > 0 &&
        gap < Math.max(step, prev.size * 1.2) * 1.35 &&
        Math.abs(line.size - prev.size) < body * 0.15 &&
        (current.kind === 'heading'
          ? heading
          : !heading &&
            // A short line ending a sentence closes the paragraph
            !(prevShort && /[.!?:]$/.test(textOf(current.runs)) && current.kind === 'paragraph') &&
            // List items continue on lines indented past the marker
            (current.kind !== 'list' || line.x > indent + body * 0.5))
      if (sameBlock && current) {
        const last = current.runs.at(-1)!
        const first = runs[0]
        if (first) {
          // Keep the break after a short line; join wrapped ones, undoing hyphenation before a lowercase letter
          if (prevShort) first.newLine = true
          else if (/[a-z]-$/.test(last.text) && /^[a-z]/.test(first.text)) last.text = last.text.slice(0, -1)
          else first.text = ` ${first.text}`
        }
        current.runs.push(...runs)
      } else {
        current = heading
          ? { kind: 'heading', level: levelOf(line.size), runs, y: line.y - line.size }
          : bullet || numbered
            ? { kind: 'list', numbered, runs: bullet ? stripBullet(runs) : runs, y: line.y - line.size }
            : { kind: 'paragraph', runs, y: line.y - line.size }
        indent = line.x
        blocks.push(current)
      }
      prev = line
    }
    // Merge runs that ended up adjacent with the same style
    for (const b of blocks)
      if ('runs' in b)
        b.runs = b.runs.reduce<Run[]>((out, r) => {
          const last = out.at(-1)
          if (last && !r.newLine && !!last.bold === !!r.bold && !!last.italic === !!r.italic) last.text += r.text
          else out.push({ ...r })
          return out
        }, [])

    page.images.forEach((img, index) => {
      blocks.push({ kind: 'image', index, y: img.y })
    })
    return blocks.sort((a, b) => a.y - b.y)
  })
}

/** Page margins in points from where the content sits, clamped to sensible values. */
export function margins(page: PageInput) {
  const boxes = [
    ...page.items.filter((i) => i.str.trim()).map((i) => [i.x, i.y - i.size, i.x + i.width, i.y] as const),
    ...page.images.map((i) => [i.x, i.y, i.x + i.width, i.y + i.height] as const),
  ]
  const clamp = (v: number) => Math.round(Math.min(72, Math.max(18, v)))
  if (!boxes.length) return { top: 36, right: 36, bottom: 36, left: 36 }
  return {
    left: clamp(Math.min(...boxes.map((b) => b[0]))),
    top: clamp(Math.min(...boxes.map((b) => b[1]))),
    right: clamp(page.width - Math.max(...boxes.map((b) => b[2]))),
    bottom: clamp(page.height - Math.max(...boxes.map((b) => b[3]))),
  }
}

export interface DocxImage {
  bytes: Uint8Array
  type: 'png' | 'jpg'
}

/** Writes the blocks as a .docx: one section per PDF page, so each starts on a new page of the same size. */
export async function toDocx(
  pages: (PageInput & { blocks: Block[]; images: (PageImage & DocxImage)[] })[],
): Promise<Uint8Array> {
  const { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } = await import('docx')
  const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const
  const body = bodySize(pages.flatMap((p) => p.items))
  const twip = (pt: number) => Math.round(pt * 20)

  const doc = new Document({
    styles: { default: { document: { run: { size: Math.round(body * 2) } } } },
    sections: pages.map((page) => {
      const m = margins(page)
      const maxWidth = page.width - m.left - m.right
      const maxHeight = page.height - m.top - m.bottom
      return {
        properties: {
          page: {
            size: { width: twip(page.width), height: twip(page.height) },
            margin: { top: twip(m.top), right: twip(m.right), bottom: twip(m.bottom), left: twip(m.left) },
          },
        },
        children: page.blocks.map((b) => {
          if (b.kind === 'image') {
            const img = page.images[b.index]!
            const s = Math.min(1, maxWidth / img.width, maxHeight / img.height)
            return new Paragraph({
              children: [
                new ImageRun({
                  type: img.type,
                  data: img.bytes,
                  // Pixels at 96 dpi
                  transformation: { width: (img.width * s * 4) / 3, height: (img.height * s * 4) / 3 },
                }),
              ],
            })
          }
          const children = b.runs.map(
            (r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, break: r.newLine ? 1 : undefined }),
          )
          if (b.kind === 'heading') return new Paragraph({ heading: levels[b.level - 1], children })
          if (b.kind === 'list' && !b.numbered) return new Paragraph({ bullet: { level: 0 }, children })
          return new Paragraph({ children })
        }),
      }
    }),
  })
  return new Uint8Array(await Packer.toArrayBuffer(doc))
}
