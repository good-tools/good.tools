import { create } from 'zustand'

export type Base64Mode = 'encode' | 'decode'

interface Base64Store {
  mode: Base64Mode
  input: string
  /** Use the URL-safe alphabet (-_) without padding when encoding */
  urlSafe: boolean
  setMode: (mode: Base64Mode) => void
  setInput: (input: string) => void
  setUrlSafe: (urlSafe: boolean) => void
  resetAll: () => void
}

export const useBase64Store = create<Base64Store>((set) => ({
  mode: 'encode',
  input: '',
  urlSafe: false,
  setMode: (mode) => set({ mode }),
  setInput: (input) => set({ input }),
  setUrlSafe: (urlSafe) => set({ urlSafe }),
  resetAll: () => set({ mode: 'encode', input: '', urlSafe: false }),
}))
