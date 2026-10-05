import { create } from 'zustand'

export type URLMode = 'encode' | 'decode'

interface URLStore {
  mode: URLMode
  input: string
  /** Decode `+` as a space (application/x-www-form-urlencoded) */
  plusAsSpace: boolean
  setMode: (mode: URLMode) => void
  setInput: (input: string) => void
  setPlusAsSpace: (value: boolean) => void
  resetAll: () => void
}

export const useURLStore = create<URLStore>((set) => ({
  mode: 'encode',
  input: '',
  plusAsSpace: false,
  setMode: (mode) => set({ mode }),
  setInput: (input) => set({ input }),
  setPlusAsSpace: (plusAsSpace) => set({ plusAsSpace }),
  resetAll: () => set({ mode: 'encode', input: '', plusAsSpace: false }),
}))
