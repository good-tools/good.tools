/** Today's local date as YYYY-MM-DD, the seed for the home page picks */
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** `n` items chosen by a seeded shuffle: the same for everyone on the same day, different the next */
export function dailyPicks<T>(items: readonly T[], seed: string, n = 3): T[] {
  // FNV-1a hash of the seed, then mulberry32 as the generator
  let s = 2166136261
  for (const c of seed) s = Math.imul(s ^ c.charCodeAt(0), 16777619)
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out.slice(0, n)
}
