import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'
import { wifiPayload } from './qr'

/** Renders a QR symbol to RGBA pixels (4 px per module, 4-module quiet zone) the way a canvas would. */
function render(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const scale = 4
  const size = (modules.size + 8) * scale
  const data = new Uint8ClampedArray(size * size * 4).fill(255)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - 4
      const my = Math.floor(y / scale) - 4
      if (mx >= 0 && my >= 0 && mx < modules.size && my < modules.size && modules.get(my, mx)) {
        data.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3)
      }
    }
  return { data, size }
}

describe('wifiPayload', () => {
  it('escapes special characters', () => {
    expect(wifiPayload({ ssid: 'My;Net', password: 'p:a"s\\s,', security: 'WPA', hidden: false })).toBe(
      'WIFI:T:WPA;S:My\\;Net;P:p\\:a\\"s\\\\s\\,;;',
    )
  })

  it('omits the password for open networks and flags hidden ones', () => {
    expect(wifiPayload({ ssid: 'Cafe', password: 'ignored', security: 'nopass', hidden: true })).toBe(
      'WIFI:T:nopass;S:Cafe;H:true;;',
    )
  })
})

describe('QR round trip', () => {
  it('decodes what it generates', () => {
    const text = wifiPayload({ ssid: 'Home', password: 'correct horse', security: 'WPA', hidden: false })
    const { data, size } = render(text)
    expect(jsQR(data, size, size)?.data).toBe(text)
  })
})
