import { create } from "zustand";

const DEFAULT_JSON_OBJ = {
  message: "Hello, World!",
};

/**
 * JSON Formatter store
 */
interface JSONFormatterStore {
  value: string;
  parsed: unknown;
  filtered: unknown;
  valid: boolean;
  query: string;
  tree: boolean;

  setValue: (value: string) => void;
  setParsed: (value: unknown) => void;
  setFiltered: (value: unknown) => void;
  setValid: (value: boolean) => void;
  setQuery: (value: string) => void;
  setTree: (value: boolean) => void;
  reset: () => void;
}

export const useJSONFormatterStore = create<JSONFormatterStore>((set) => ({
  value: JSON.stringify(DEFAULT_JSON_OBJ, null, 2),
  parsed: DEFAULT_JSON_OBJ,
  filtered: DEFAULT_JSON_OBJ,
  valid: true,
  query: "",
  tree: true,

  setValue: (v) => set({ value: v }),
  setParsed: (v) => set({ parsed: v }),
  setFiltered: (v) => set({ filtered: v }),
  setValid: (v) => set({ valid: v }),
  setQuery: (v) => set({ query: v }),
  setTree: (v) => set({ tree: v }),
  reset: () =>
    set({
      value: JSON.stringify(DEFAULT_JSON_OBJ, null, 2),
      parsed: DEFAULT_JSON_OBJ,
      filtered: DEFAULT_JSON_OBJ,
      valid: true,
      query: "",
      tree: true,
    }),
}));
