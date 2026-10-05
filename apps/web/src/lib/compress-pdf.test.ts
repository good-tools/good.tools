import { describe, expect, it } from 'vitest'
import { type ImageInfo, maxSide, planImage, savedPercent, shouldReplace } from './compress-pdf'

const photo: ImageInfo = {
  width: 4000,
  height: 3000,
  bitsPerComponent: 8,
  components: 3,
  filter: 'DCTDecode',
  predictor: false,
  special: false,
}

describe('planImage', () => {
  it('downscales big images to the preset resolution, keeping aspect ratio', () => {
    expect(maxSide('balanced')).toBe(1755)
    expect(planImage(photo, 'balanced')).toEqual({ width: 1755, height: 1316 })
    expect(planImage(photo, 'smallest')?.width).toBe(maxSide('smallest'))
  })

  it('keeps the size of images already below the target but still re-encodes them', () => {
    expect(planImage({ ...photo, width: 800, height: 600 }, 'high')).toEqual({ width: 800, height: 600 })
    expect(planImage({ ...photo, filter: 'FlateDecode', components: 1 }, 'high')).not.toBeNull()
  })

  it('leaves images it cannot recompress safely alone', () => {
    expect(planImage({ ...photo, width: 100, height: 100 }, 'smallest')).toBeNull() // tiny
    expect(planImage({ ...photo, components: 4 }, 'smallest')).toBeNull() // CMYK
    expect(planImage({ ...photo, components: 0 }, 'smallest')).toBeNull() // indexed
    expect(planImage({ ...photo, bitsPerComponent: 1 }, 'smallest')).toBeNull() // bilevel scan
    expect(planImage({ ...photo, filter: 'JBIG2Decode' }, 'smallest')).toBeNull()
    expect(planImage({ ...photo, filter: 'CCITTFaxDecode' }, 'smallest')).toBeNull()
    expect(planImage({ ...photo, filter: 'multiple' }, 'smallest')).toBeNull()
    expect(planImage({ ...photo, filter: 'FlateDecode', predictor: true }, 'smallest')).toBeNull()
    expect(planImage({ ...photo, special: true }, 'smallest')).toBeNull()
  })
})

describe('shouldReplace', () => {
  it('replaces only when clearly smaller', () => {
    expect(shouldReplace(1000, 899)).toBe(true)
    expect(shouldReplace(1000, 950)).toBe(false)
    expect(shouldReplace(1000, 1000)).toBe(false)
    expect(shouldReplace(1000, 2000)).toBe(false)
  })
})

describe('savedPercent', () => {
  it('computes the saving, negative when the file grew', () => {
    expect(savedPercent(1000, 250)).toBe(75)
    expect(savedPercent(1000, 1100)).toBe(-10)
    expect(savedPercent(3, 2)).toBe(33.3)
    expect(savedPercent(0, 10)).toBe(0)
  })
})
