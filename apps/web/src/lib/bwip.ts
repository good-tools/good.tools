// Lazy-loaded: named encoders keep the rest of bwip-js's symbologies out of the bundle.
import {
  azteccode,
  code39,
  code128,
  datamatrix,
  drawingCanvas,
  drawingSVG,
  ean8,
  ean13,
  itf14,
  pdf417,
  type RenderOptions,
  upca,
} from 'bwip-js/browser'
import { isLinear, type Symbology } from './barcode'

const ENCODERS = { azteccode, code39, code128, datamatrix, ean8, ean13, itf14, pdf417, upca }

export type Barcode = Exclude<Symbology, 'qrcode'>

export const barcodeOptions = (s: Barcode, text: string, includetext: boolean, scale: number): RenderOptions => ({
  bcid: s,
  text,
  scale,
  includetext: includetext && isLinear(s),
  backgroundcolor: 'FFFFFF',
  paddingwidth: 10,
  paddingheight: 10,
})

/** SVG markup at scale 3 (bwip-js throws a readable Error on input the symbology can't encode). */
export function barcodeSvg(s: Barcode, text: string, includetext: boolean) {
  const svg = ENCODERS[s](barcodeOptions(s, text, includetext, 3), drawingSVG())
  // bwip-js only sets a viewBox; give the <img> an intrinsic size too
  return svg.replace(/viewBox="0 0 (\d+) (\d+)"/, '$& width="$1" height="$2"')
}

/** PNG roughly `width` px wide, using a whole-pixel module size so the bars stay sharp. */
export function barcodePng(s: Barcode, text: string, includetext: boolean, width: number): Promise<Blob> {
  const at3 = Number(/width="(\d+)"/.exec(barcodeSvg(s, text, includetext))?.[1])
  const scale = Math.max(1, Math.round((width * 3) / at3))
  const canvas = document.createElement('canvas')
  ENCODERS[s](barcodeOptions(s, text, includetext, scale), drawingCanvas(canvas))
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
  )
}
