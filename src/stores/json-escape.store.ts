import { create } from 'zustand'

/**
 * JSON Escape/Unescape store
 * Simple store for managing the text area input
 */
interface JsonEscapeStore {
  input: string
  setInput: (value: string) => void
  reset: () => void
}

export const useJsonEscapeStore = create<JsonEscapeStore>((set) => ({
  input: '',
  setInput: (value) => set({ input: value }),
  reset: () => set({ input: '' }),
}))
