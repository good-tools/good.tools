import engUrl from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url'
import { createWorker, OEM, type Worker } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
import coreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'

/**
 * English Tesseract worker served from this site (no CDN): ~3 MB of language data and a ~4 MB engine,
 * fetched on first use. Tesseract builds the data URL as `${langPath}/eng.traineddata.gz`, so the build
 * keeps that file's name unhashed (see vite.config.ts).
 */
export const createOcrWorker = (onProgress: (progress: number) => void) =>
  new Promise<Worker>((resolve, reject) => {
    createWorker('eng', OEM.LSTM_ONLY, {
      langPath: new URL('.', new URL(engUrl, location.href)).href,
      workerPath: workerUrl,
      corePath: coreUrl,
      workerBlobURL: false,
      cacheMethod: 'none',
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress(m.progress)
      },
      // A failed language download only reaches this handler; createWorker itself would never settle
      errorHandler: (e: unknown) => reject(new Error(`OCR failed: ${e}`)),
    }).then(resolve, reject)
  })
