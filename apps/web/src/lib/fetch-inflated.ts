/** Fetches a .gz asset, inflating it unless the server already did (Content-Encoding: gzip). */
export async function fetchInflated(path: string): Promise<ArrayBuffer> {
  const res = await fetch(new URL(path, self.location.href))
  if (!res.ok) throw new Error(`Failed to download ${path}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  const head = new Uint8Array(buf, 0, 2)
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}
