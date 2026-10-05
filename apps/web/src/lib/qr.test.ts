import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { toBuffer } from 'bwip-js/node'
import QRCode from 'qrcode'
import { beforeAll, describe, expect, it } from 'vitest'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { barcodeText, gs1CheckDigit, SYMBOLOGIES } from './barcode'
import { type Barcode, barcodeOptions } from './bwip'
import { wifiPayload } from './qr'

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

describe('barcodeText', () => {
  it('computes GS1 check digits', () => {
    expect(gs1CheckDigit('590123412345')).toBe(7)
    expect(gs1CheckDigit('9638507')).toBe(4)
    expect(gs1CheckDigit('03600029145')).toBe(2)
    expect(gs1CheckDigit('1540014128876')).toBe(3)
    expect(gs1CheckDigit('400638133393')).toBe(1)
  })

  it('appends a missing check digit and accepts a correct one', () => {
    expect(barcodeText('ean13', '590123412345')).toBe('5901234123457')
    expect(barcodeText('ean13', '5901234123457')).toBe('5901234123457')
    expect(barcodeText('upca', '03600029145')).toBe('036000291452')
    expect(barcodeText('ean8', '9638507')).toBe('96385074')
    expect(barcodeText('itf14', '1540014128876')).toBe('15400141288763')
  })

  it('rejects bad input with a readable message', () => {
    expect(() => barcodeText('ean13', '5901234123450')).toThrow('Wrong check digit: EAN-13 590123412345 ends in 7')
    expect(() => barcodeText('ean13', '12345')).toThrow('EAN-13 needs 12 digits, or 13 with the check digit')
    expect(() => barcodeText('upca', '0360002914a')).toThrow('UPC-A takes digits only')
    expect(() => barcodeText('code39', 'abc')).toThrow('Code 39 supports only')
    expect(() => barcodeText('code128', 'café')).toThrow('Code 128 supports ASCII characters only')
    expect(barcodeText('datamatrix', 'café ✓')).toBe('café ✓')
  })
})

describe('generate → read round trip', () => {
  beforeAll(() => {
    const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
    prepareZXingModule({ overrides: { wasmBinary: wasm.buffer as ArrayBuffer } })
  })

  const read = async (png: Uint8Array) => (await readBarcodes(png))[0]

  it('QR Code', async () => {
    const text = wifiPayload({ ssid: 'Home', password: 'correct horse', security: 'WPA', hidden: false })
    const hit = await read(await QRCode.toBuffer(text))
    expect([hit?.format, hit?.text]).toEqual(['QRCode', text])
  })

  // zxing-cpp reports UPC-A as EAN-13 with a leading 0, and ITF-14 as ITF
  const expected: Record<string, [string, string]> = {
    code128: ['Code128', 'GOOD-TOOLS-128'],
    ean13: ['EAN13', '5901234123457'],
    ean8: ['EAN8', '96385074'],
    upca: ['EAN13', '0036000291452'],
    code39: ['Code39', 'GOOD-TOOLS'],
    itf14: ['ITF', '15400141288763'],
    datamatrix: ['DataMatrix', 'https://good.tools'],
    pdf417: ['PDF417', 'https://good.tools'],
    azteccode: ['Aztec', 'https://good.tools'],
  }

  for (const [id, label, example] of SYMBOLOGIES.filter(([id]) => id !== 'qrcode')) {
    it(label, async () => {
      const png = await toBuffer(barcodeOptions(id as Barcode, barcodeText(id, example), true, 3))
      const hit = await read(new Uint8Array(png))
      expect([hit?.format, hit?.text]).toEqual(expected[id])
    })
  }
})
