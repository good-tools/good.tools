import { XMLParser, XMLValidator } from 'fast-xml-parser'
import xmlFormat from 'xml-formatter'
import { create } from 'zustand'

const DEFAULT_VALUE = `<?xml version="1.0" encoding="UTF-8"?>
<greeting>Hello, world!</greeting>`

export type XmlOutput = { kind: 'xml' | 'json'; text: string } | { kind: 'tree'; data: unknown }
type Action = 'format' | 'minify' | 'json' | 'tree'

/** Returns a validation message, or null for valid/empty input. */
export function validateXml(value: string): string | null {
  if (!value.trim()) return null
  const r = XMLValidator.validate(value)
  return r === true ? null : `${r.err.msg} (line ${r.err.line}, column ${r.err.col})`
}

export function transformXml(value: string, action: Action): XmlOutput {
  switch (action) {
    case 'format':
      return { kind: 'xml', text: xmlFormat(value, { collapseContent: true, lineSeparator: '\n' }) }
    case 'minify':
      return { kind: 'xml', text: xmlFormat.minify(value, { collapseContent: true }) }
    case 'json':
      return { kind: 'json', text: JSON.stringify(new XMLParser().parse(value), null, 2) }
    case 'tree':
      return { kind: 'tree', data: new XMLParser().parse(value) as unknown }
  }
}

interface XMLFormatterStore {
  value: string
  error: string | null
  output: XmlOutput | null
  setValue: (value: string) => void
  run: (action: Action) => void
  reset: () => void
}

export const useXMLFormatterStore = create<XMLFormatterStore>((set, get) => ({
  value: DEFAULT_VALUE,
  error: null,
  output: null,
  setValue: (value) => set({ value, error: validateXml(value), ...(value.trim() ? {} : { output: null }) }),
  run: (action) => {
    const { value } = get()
    const error = validateXml(value)
    if (error || !value.trim()) return set({ error, output: null })
    try {
      set({ output: transformXml(value, action), error: null })
    } catch (e) {
      set({ output: null, error: e instanceof Error ? e.message : String(e) })
    }
  },
  reset: () => set({ value: DEFAULT_VALUE, error: null, output: null }),
}))
