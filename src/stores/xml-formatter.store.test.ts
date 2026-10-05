import { beforeEach, describe, expect, it } from 'vitest'
import { useXMLFormatterStore } from './xml-formatter.store'

const s = () => useXMLFormatterStore.getState()

beforeEach(() => s().reset())

describe('xml formatter store', () => {
  it('formats, minifies and converts', () => {
    s().setValue('<a><b>1</b></a>')
    s().run('format')
    expect(s().output).toEqual({ kind: 'xml', text: '<a>\n    <b>1</b>\n</a>' })
    s().run('minify')
    expect(s().output).toEqual({ kind: 'xml', text: '<a><b>1</b></a>' })
    s().run('json')
    expect(s().output?.kind).toBe('json')
  })

  it('reports invalid XML with a position and never throws', () => {
    s().setValue('<a><b></a>')
    expect(s().error).toMatch(/line 1/)
    expect(() => s().run('minify')).not.toThrow()
    expect(s().output).toBeNull()
  })

  it('clearing the input resets error and output', () => {
    s().run('format')
    s().setValue('<a>')
    s().setValue('')
    expect(s().error).toBeNull()
    expect(s().output).toBeNull()
  })
})
