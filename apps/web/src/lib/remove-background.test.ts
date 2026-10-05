import { describe, expect, it } from 'vitest'
import { SIZE, toInput, toMask } from './remove-background'

describe('toInput', () => {
  it('normalizes RGBA pixels into planar RGB', () => {
    const rgba = new Uint8ClampedArray(SIZE * SIZE * 4)
    rgba.set([255, 0, 128, 255])
    const out = toInput(rgba)
    const n = SIZE * SIZE
    expect(out).toHaveLength(3 * n)
    expect(out[0]).toBeCloseTo((1 - 0.485) / 0.229)
    expect(out[n]).toBeCloseTo((0 - 0.456) / 0.224)
    expect(out[2 * n]).toBeCloseTo((128 / 255 - 0.406) / 0.225)
  })
})

describe('toMask', () => {
  it('stretches the map to 0..255 alpha', () => {
    expect(Array.from(toMask(new Float32Array([0.2, 0.6, 0.3])))).toEqual([0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 64])
  })

  it('handles a flat map', () => {
    expect(Array.from(toMask(new Float32Array([0.5, 0.5])))).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })
})
