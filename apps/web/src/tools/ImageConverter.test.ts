import { describe, expect, it, vi } from 'vitest'
import { zoomAt } from './ImageConverter'

// The worker module starts wasm-vips when imported; only its constant is needed here
vi.mock('@/workers/vips.worker', () => ({ HEIF_WORKER: 'vips-heif' }))

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, 100, 50)
    expect(v).toEqual({ zoom: 2, x: -100, y: -50 })
    // image point (100, 50) still maps to screen (100, 50)
    expect(v.x + v.zoom * 100).toBe(100)
    const w = zoomAt(v, 2, 10, 10)
    expect(w.zoom).toBe(4)
    expect(w.x + w.zoom * ((10 - v.x) / v.zoom)).toBeCloseTo(10)
  })

  it('clamps between fit and 32x', () => {
    expect(zoomAt({ x: -40, y: -40, zoom: 2 }, 0.1, 0, 0)).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(zoomAt({ x: 0, y: 0, zoom: 16 }, 10, 0, 0).zoom).toBe(32)
  })
})
