// Minimal key-value store on IndexedDB (no size cap like localStorage's ~5 MB).
let db: Promise<IDBDatabase> | undefined

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('good-tools', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  db ??= open().catch((e) => {
    db = undefined // retry opening on the next call
    throw e
  })
  const d = await db
  return new Promise((resolve, reject) => {
    const tx = d.transaction('kv', mode)
    const r = fn(tx.objectStore('kv'))
    tx.oncomplete = () => resolve(r.result)
    tx.onerror = tx.onabort = () => reject(tx.error ?? r.error)
  })
}

export const idbGet = <T>(key: string) => run<T | undefined>('readonly', (s) => s.get(key))
export const idbSet = (key: string, value: unknown) => run('readwrite', (s) => s.put(value, key)).then(() => {})
export const idbDelete = (key: string) => run('readwrite', (s) => s.delete(key)).then(() => {})
