import { describe, expect, it } from 'vitest'
import { interpolate, renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('builds a toc with unique ids and source lines', () => {
    const { html, toc } = renderMarkdown(
      '# Intro\n\ntext\n\n## **Bold** part\n\n```\n# not a heading\n```\n\n## Intro\n',
    )
    expect(toc).toEqual([
      { depth: 1, text: 'Intro', id: 'intro', line: 1 },
      { depth: 2, text: 'Bold part', id: 'bold-part', line: 5 },
      { depth: 2, text: 'Intro', id: 'intro-1', line: 11 },
    ])
    expect(html).toContain('<h2 data-line="5" id="bold-part"><strong>Bold</strong> part</h2>')
    expect(html).toContain('<p data-line="3">text</p>')
  })

  it('renders GFM tables, task lists and strikethrough', () => {
    const { html } = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n~~gone~~')
    expect(html).toContain('<table data-line="1">')
    expect(html).toMatch(/<input[^>]*checked/)
    expect(html).toContain('<del>gone</del>')
  })

  it('marks mermaid blocks and escapes their source', () => {
    expect(renderMarkdown('```mermaid\ngraph TD; A-->B<br>\n```').html).toContain(
      '<pre data-line="1" class="mermaid">graph TD; A--&gt;B&lt;br&gt;</pre>',
    )
  })

  it('strips scripts and opens external links in a new tab', () => {
    const { html } = renderMarkdown('<img src=x onerror=alert(1)><script>alert(1)</script>[x](https://e.com)')
    expect(html).not.toMatch(/onerror|<script/)
    expect(html).toContain('target="_blank"')
  })
})

it('highlights known languages and escapes unknown ones', () => {
  expect(renderMarkdown('```ts\nconst a = 1\n```').html).toContain('<span class="hljs-keyword">const</span>')
  expect(renderMarkdown('```nope\n<b>\n```').html).toContain('<code class="hljs">&lt;b&gt;')
})

it('interpolates between points and clamps at the ends', () => {
  const pts: [number, number][] = [
    [1, 0],
    [5, 100],
    [5, 100],
    [9, 300],
  ]
  expect(interpolate(pts, 3)).toBe(50)
  expect(interpolate(pts, 7)).toBe(200)
  expect(interpolate(pts, 0)).toBe(0)
  expect(interpolate(pts, 20)).toBe(300)
})
