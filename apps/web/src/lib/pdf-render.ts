import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export interface RenderedPage {
  /** JPEG data URL */
  url: string
  /** Page size in points as displayed (crop box, page rotation applied) */
  width: number
  height: number
}

/**
 * Renders every page to fit `maxPx` on its long side (pdf.js, which runs in its own worker), one at a time.
 * Stops early once `live()` turns false, e.g. after the user opened another file.
 */
export async function renderPages(
  bytes: Uint8Array,
  maxPx: number,
  onPage: (index: number, page: RenderedPage) => void,
  live: () => boolean = () => true,
) {
  // pdf.js transfers the buffer to its worker; keep the caller's for saving
  const task = getDocument({ data: bytes.slice() })
  try {
    const doc = await task.promise
    for (let n = 1; n <= doc.numPages && live(); n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: maxPx / Math.max(base.width, base.height) })
      const canvas = Object.assign(document.createElement('canvas'), {
        width: Math.ceil(viewport.width),
        height: Math.ceil(viewport.height),
      })
      await page.render({ canvas, viewport }).promise
      if (live()) onPage(n - 1, { url: canvas.toDataURL('image/jpeg', 0.8), width: base.width, height: base.height })
    }
  } finally {
    void task.destroy()
  }
}
