import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export type NotesView = 'code' | 'split' | 'preview'

export interface Note {
  id: string
  body: string
  updated: number
}

const WELCOME = `# Welcome to Markdown Notes

Notes are saved in this browser only (local storage). Nothing is uploaded.

## Formatting

GitHub-flavoured markdown: **bold**, _italic_, ~~strikethrough~~, \`code\`, [links](https://good.tools).

- [x] Task lists
- [ ] Your next note

| Feature | Supported |
| ------- | :-------: |
| Tables  | yes       |
| Mermaid | yes       |

## Diagrams

\`\`\`mermaid
graph LR
  Write --> Preview --> Share
\`\`\`

## Code

\`\`\`ts
const hello = (name: string) => \`Hello, \${name}\`
\`\`\`
`

/** First non-empty line without markdown heading marks */
export const noteTitle = (n: Note) =>
  n.body
    .split('\n')
    .find((l) => l.trim())
    ?.replace(/^\s*#+\s*/, '')
    .trim() || 'Untitled'

const newNote = (body = ''): Note => ({ id: crypto.randomUUID(), body, updated: Date.now() })

/** Set when the browser refuses to save (quota exceeded, storage disabled) so the UI can warn. */
export const useNotesSaveError = create<{ error?: string }>(() => ({}))

const storage: StateStorage = {
  getItem: (k) => localStorage.getItem(k),
  removeItem: (k) => localStorage.removeItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
      if (useNotesSaveError.getState().error) useNotesSaveError.setState({ error: undefined })
    } catch (e) {
      useNotesSaveError.setState({ error: e instanceof Error ? e.message : String(e) })
    }
  },
}

interface NotesStore {
  notes: Note[]
  activeId: string
  view: NotesView
  create: (body?: string) => void
  update: (body: string) => void
  remove: (id: string) => void
  select: (id: string) => void
  setView: (view: NotesView) => void
}

const first = newNote(WELCOME)

// ponytail: the whole notebook is rewritten to localStorage on every edit; move to IndexedDB if notes reach MBs
export const useNotesStore = create<NotesStore>()(
  persist(
    (set) => ({
      notes: [first],
      activeId: first.id,
      view: 'split',
      create: (body) => {
        const n = newNote(body)
        set((s) => ({ notes: [n, ...s.notes], activeId: n.id }))
      },
      update: (body) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === s.activeId ? { ...n, body, updated: Date.now() } : n)),
        })),
      remove: (id) =>
        set((s) => {
          const [head = newNote(), ...rest] = s.notes.filter((n) => n.id !== id)
          return { notes: [head, ...rest], activeId: s.activeId === id ? head.id : s.activeId }
        }),
      select: (activeId) => set({ activeId }),
      setView: (view) => set({ view }),
    }),
    {
      name: 'good-tools:notes',
      storage: createJSONStorage(() => storage),
      partialize: ({ notes, activeId, view }) => ({ notes, activeId, view }),
      // Never load an empty notebook: the UI assumes at least one note
      merge: (saved, current) => {
        const s = saved as Partial<NotesStore> | undefined
        return s?.notes?.length ? { ...current, ...s } : current
      },
    },
  ),
)

// Keep tabs in sync: another tab saving reloads the notebook here
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === 'good-tools:notes') useNotesStore.persist.rehydrate()
  })
