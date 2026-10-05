/** Pre- and post-processing for the U²-Netp background removal model. */

/** The model's fixed input size */
export const SIZE = 320
// ImageNet mean and standard deviation per RGB channel
const NORM = [
  [0.485, 0.229],
  [0.456, 0.224],
  [0.406, 0.225],
] as const

/** RGBA pixels (SIZE×SIZE) → normalized float CHW tensor data */
export function toInput(rgba: Uint8ClampedArray): Float32Array {
  const n = SIZE * SIZE
  const out = new Float32Array(3 * n)
  NORM.forEach(([mean, std], c) => {
    for (let i = 0; i < n; i++) out[c * n + i] = ((rgba[i * 4 + c] ?? 0) / 255 - mean) / std
  })
  return out
}

/** Saliency map → RGBA mask whose alpha is the map stretched to 0..255 (as rembg does) */
export function toMask(map: Float32Array): Uint8ClampedArray<ArrayBuffer> {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const v of map) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min || 1
  const out = new Uint8ClampedArray(map.length * 4)
  map.forEach((v, i) => {
    out[i * 4 + 3] = ((v - min) / range) * 255
  })
  return out
}
