import { create } from 'zustand'
import jp from 'jsonpath'

const DEFAULT_VALUE = JSON.stringify({ message: 'Hello, World!' }, null, 2)

type Parsed = { parsed: unknown; error: string | null }

/** Parses editor text. Empty input is neither valid nor an error. */
export function parseJson(value: string): Parsed {
  if (!value.trim()) return { parsed: undefined, error: null }
  try {
    return { parsed: JSON.parse(value) as unknown, error: null }
  } catch (e) {
    return { parsed: undefined, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Applies a JSONPath query; an empty query returns the input unchanged. */
export function applyJsonPath(data: unknown, query: string): { result: unknown; error: string | null } {
  if (!query.trim() || data === undefined) return { result: data, error: null }
  try {
    return { result: jp.query(data, query), error: null }
  } catch (e) {
    return { result: undefined, error: e instanceof Error ? e.message : String(e) }
  }
}

interface JSONFormatterStore extends Parsed {
  value: string
  query: string
  tree: boolean

  /** Sets the editor text and re-parses it */
  setValue: (value: string) => void
  setQuery: (value: string) => void
  setTree: (value: boolean) => void
  reset: () => void
}

const initial = () => ({ value: DEFAULT_VALUE, ...parseJson(DEFAULT_VALUE), query: '', tree: true })

export const useJSONFormatterStore = create<JSONFormatterStore>((set) => ({
  ...initial(),
  setValue: (value) => set({ value, ...parseJson(value) }),
  setQuery: (query) => set({ query }),
  setTree: (tree) => set({ tree }),
  reset: () => set(initial()),
}))
