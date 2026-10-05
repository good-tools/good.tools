import { create } from 'zustand'

export type JsonEscapeMode = 'escape' | 'unescape'

/** JSON Escape/Unescape store */
interface JsonEscapeStore {
  mode: JsonEscapeMode
  input: string
  setMode: (mode: JsonEscapeMode) => void
  setInput: (value: string) => void
  reset: () => void
}

export const useJsonEscapeStore = create<JsonEscapeStore>((set) => ({
  mode: 'escape',
  input: '',
  setMode: (mode) => set({ mode }),
  setInput: (input) => set({ input }),
  reset: () => set({ mode: 'escape', input: '' }),
}))
