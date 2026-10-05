/** Image recompression presets, labelled by intent. */
export const PRESETS = {
  smallest: { label: 'Smallest', hint: '96 dpi images, JPEG quality 50', dpi: 96, quality: 50 },
  balanced: { label: 'Balanced', hint: '150 dpi images, JPEG quality 70', dpi: 150, quality: 70 },
  high: { label: 'High quality', hint: '220 dpi images, JPEG quality 85', dpi: 220, quality: 85 },
} as const

export type Preset = keyof typeof PRESETS

/** What we need to know about an image XObject to decide whether to touch it. */
export interface ImageInfo {
  width: number
  height: number
  bitsPerComponent: number
  /** Colour components (1 gray, 3 RGB, 4 CMYK); 0 when unknown or indexed */
  components: number
  /** The single stream filter, '' for none; 'multiple' when chained */
  filter: string
  /** Has PNG/TIFF predictors in DecodeParms */
  predictor: boolean
  /** /ImageMask, /Mask, or a /Decode array: inverted or masked pixels we'd get wrong */
  special: boolean
}

/** Images below this many pixels are icons and rules; recompressing them saves nothing. */
export const MIN_PIXELS = 128 * 128

/** Longest side of an image that fills an A4/Letter page (11.7 in) at the preset's DPI. */
// ponytail: assumes images fill at most a page; placement-aware DPI needs the content-stream CTM
export const maxSide = (preset: Preset) => Math.round(PRESETS[preset].dpi * 11.7)

/** Target pixel size for an image, or null to leave it alone. */
export function planImage(info: ImageInfo, preset: Preset): { width: number; height: number } | null {
  const { width, height } = info
  if (info.special || info.predictor || info.bitsPerComponent !== 8) return null
  if (info.components !== 1 && info.components !== 3) return null // CMYK/indexed/unknown: JPEG would shift colours
  if (info.filter !== 'DCTDecode' && info.filter !== 'FlateDecode' && info.filter !== '') return null // JBIG2, CCITT, JPX…
  if (width * height < MIN_PIXELS) return null
  const scale = Math.min(1, maxSide(preset) / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Only swap an image in when it saves at least 10%: re-encoding a JPEG for less isn't worth the generation loss. */
export const shouldReplace = (originalBytes: number, newBytes: number) => newBytes < originalBytes * 0.9

/** Percentage saved going from `before` to `after` bytes; negative when the result grew. */
export const savedPercent = (before: number, after: number) =>
  before ? Math.round(((before - after) / before) * 1000) / 10 : 0
