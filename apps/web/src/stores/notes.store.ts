import { create } from 'zustand'
import { type PersistStorage, persist, type StorageValue } from 'zustand/middleware'
import { idbDelete, idbGet, idbUpdate } from '@/lib/idb'

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

export interface Notebook {
  notes: Note[]
  /** Ids of deleted notes, so a merge with another tab's copy doesn't bring them back */
  deleted: string[]
}

/** Merges two copies of the notebook (e.g. from two tabs): the newer version of each note wins, deletions stick. */
export function mergeNotebooks(a: Notebook, b: Notebook): Notebook {
  // ponytail: deleted ids are kept forever (~40 bytes each); prune old ones if that ever matters
  const deleted = [...new Set([...a.deleted, ...b.deleted])]
  const gone = new Set(deleted)
  const byId = new Map<string, Note>()
  for (const n of [...a.notes, ...b.notes]) {
    const current = byId.get(n.id)
    if (!gone.has(n.id) && (!current || n.updated > current.updated)) byId.set(n.id, n)
  }
  return { notes: [...byId.values()], deleted }
}

type Saved = Notebook & { activeId: string; view: NotesView; syncScroll: boolean; showNotes: boolean; showToc: boolean }

const storage: PersistStorage<Saved> = {
  getItem: (k) =>
    idbGet<StorageValue<Saved>>(k).then(
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
  setItem: (k, value) => {
    if (loadFailed) return
    // Merge with what's stored instead of overwriting it: another tab may have saved since we last loaded
    return idbUpdate<StorageValue<Saved>>(k, (stored) =>
      stored ? { ...value, state: { ...value.state, ...mergeNotebooks(stored.state, value.state) } } : value,
    ).then(
      () => {
        if (useNotesStatus.getState().error) useNotesStatus.setState({ error: undefined })
        channel?.postMessage('saved')
      },
      (e) => useNotesStatus.setState({ error: `Could not save notes: ${message(e)}. Download your note to keep it.` }),
    )
  },
  removeItem: (k) => idbDelete(k),
}

interface NotesStore extends Notebook {
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
      deleted: [],
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
          return {
            notes: [head, ...rest],
            deleted: [...s.deleted, id],
            activeId: s.activeId === id ? head.id : s.activeId,
          }
        }),
      select: (activeId) => set({ activeId }),
      setView: (view) => set({ view }),
      setSyncScroll: (syncScroll) => set({ syncScroll }),
      toggleNotes: () => set((s) => ({ showNotes: !s.showNotes })),
      toggleToc: () => set((s) => ({ showToc: !s.showToc })),
    }),
    {
      name: 'good-tools:notes',
      storage,
      partialize: ({ notes, deleted, activeId, view, syncScroll, showNotes, showToc }) => ({
        notes,
        deleted,
        activeId,
        view,
        syncScroll,
        showNotes,
        showToc,
      }),
      onRehydrateStorage: () => () => useNotesStatus.setState({ loaded: true }),
      merge: (saved, current) => {
        const s = saved as Partial<Saved> | undefined
        if (!s?.notes) return current
        const savedBook = { notes: s.notes, deleted: s.deleted ?? [] }
        // First load: take everything saved (replacing the built-in welcome note)
        if (!useNotesStatus.getState().loaded) {
          return { ...current, ...s, notes: savedBook.notes.length ? savedBook.notes : [newNote()] }
        }
        // Another tab saved: merge only the notes, so an edit still being saved here survives,
        // and keep this tab's selection and view settings
        const { notes, deleted } = mergeNotebooks(current, savedBook)
        const [first = newNote()] = notes
        const activeId = notes.some((n) => n.id === current.activeId) ? current.activeId : first.id
        return { ...current, notes: notes.length ? notes : [first], deleted, activeId }
      },
    },
  ),
)

// Keep tabs in sync: another tab saving reloads the notebook here (rehydrating doesn't save, so no echo)
channel?.addEventListener('message', () => void useNotesStore.persist.rehydrate())
