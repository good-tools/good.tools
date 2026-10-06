import { describe, expect, it } from 'vitest'
import { printableHtml } from './print-document'

describe('printableHtml', () => {
  const html = printableHtml('Q3 <plan> "draft"\\', '<h1>Hi</h1>', 'https://good.tools')

  it('wraps the body in a titled document', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.title).toBe('Q3 <plan> "draft"\\')
    expect(doc.querySelector('main.doc h1')?.textContent).toBe('Hi')
  })

  it('embeds the fonts by absolute url and escapes the title in the page footer', () => {
    expect(html).toMatch(/@font-face\{font-family:'Inter';src:url\('https:\/\/good\.tools\//)
    expect(html).toContain('@bottom-left{content:"Q3 <plan> \\"draft\\"\\\\"}')
  })
})
