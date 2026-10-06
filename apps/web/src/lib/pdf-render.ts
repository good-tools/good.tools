import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Renders every page (pdf.js, which runs in its own worker), one at a time, as JPEG data URLs whose longer side
 * is `size` pixels. Stops early once `live()` turns false, e.g. when another file was opened.
 */
export async function renderPages(
  bytes: Uint8Array,
  size: number,
  onPage: (index: number, url: string) => void,
  live: () => boolean = () => true,
) {
  // pdf.js transfers the buffer to its worker; keep the caller's for saving
  const task = getDocument({ data: bytes.slice() })
  try {
    const doc = await task.promise
    for (let n = 1; n <= doc.numPages && live(); n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: size / Math.max(base.width, base.height) })
      const canvas = Object.assign(document.createElement('canvas'), {
        width: Math.ceil(viewport.width),
        height: Math.ceil(viewport.height),
      })
      await page.render({ canvas, viewport }).promise
      if (live()) onPage(n - 1, canvas.toDataURL('image/jpeg', 0.8))
    }
  } finally {
    void task.destroy()
  }
}
