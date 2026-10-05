import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { idbDelete, idbGet, idbSet } from '@/lib/idb'

export type NotesView = 'code' | 'split' | 'preview'

export interface Note {
  id: string
  body: string
  updated: number
}

const WELCOME = `# Welcome to Markdown Notes

Notes are saved in this browser only. Nothing is uploaded.

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

/** Load/save status, kept out of the persisted store so updating it never triggers a save. */
export const useNotesStatus = create<{ loaded: boolean; error?: string }>(() => ({ loaded: false }))

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('good-tools:notes') : undefined
// If loading failed, saving would overwrite the notes we couldn't read, so refuse until a reload succeeds
let loadFailed = false

const storage: StateStorage = {
  getItem: (k) =>
    idbGet<string>(k).then(
      (v) => {
        loadFailed = false
        return v ?? null
      },
      (e) => {
        loadFailed = true
        useNotesStatus.setState({ error: `Could not load notes: ${message(e)}. Changes are not being saved.` })
        return null
      },
    ),
  setItem: (k, v) => {
    if (loadFailed) return
    return idbSet(k, v).then(
      () => {
        if (useNotesStatus.getState().error) useNotesStatus.setState({ error: undefined })
        channel?.postMessage('saved')
      },
      (e) => useNotesStatus.setState({ error: `Could not save notes: ${message(e)}. Download your note to keep it.` }),
    )
  },
  removeItem: (k) => idbDelete(k),
}

interface NotesStore {
  notes: Note[]
  activeId: string
  view: NotesView
  syncScroll: boolean
  showNotes: boolean
  showToc: boolean
  create: (body?: string) => void
  update: (body: string) => void
  remove: (id: string) => void
  select: (id: string) => void
  setView: (view: NotesView) => void
  setSyncScroll: (syncScroll: boolean) => void
  toggleNotes: () => void
  toggleToc: () => void
}

const first = newNote(WELCOME)

export const useNotesStore = create<NotesStore>()(
  persist(
    (set) => ({
      notes: [first],
      activeId: first.id,
      view: 'split',
      syncScroll: true,
      showNotes: true,
      showToc: true,
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
      setSyncScroll: (syncScroll) => set({ syncScroll }),
      toggleNotes: () => set((s) => ({ showNotes: !s.showNotes })),
      toggleToc: () => set((s) => ({ showToc: !s.showToc })),
    }),
    {
      name: 'good-tools:notes',
      storage: createJSONStorage(() => storage),
      partialize: ({ notes, activeId, view, syncScroll, showNotes, showToc }) => ({
        notes,
        activeId,
        view,
        syncScroll,
        showNotes,
        showToc,
      }),
      onRehydrateStorage: () => () => useNotesStatus.setState({ loaded: true }),
      // Never load an empty notebook: the UI assumes at least one note
      merge: (saved, current) => {
        const s = saved as Partial<NotesStore> | undefined
        return s?.notes?.length ? { ...current, ...s } : current
      },
    },
  ),
)

// Keep tabs in sync: another tab saving reloads the notebook here (rehydrating doesn't save, so no echo)
channel?.addEventListener('message', () => void useNotesStore.persist.rehydrate())
