// @vitest-environment node
import { createRequire } from 'node:module'
import { PDFDocument } from '@cantoo/pdf-lib'
import { expect, it, vi } from 'vitest'
import { protectPdf, unlockPdf } from './qpdf'

// Emscripten in Node reads the .wasm from disk, not from Vite's dev URL
vi.mock('@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url', () => ({
  default: createRequire(import.meta.url).resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'),
}))

it('protects with AES-256 and unlocks', async () => {
  const doc = await PDFDocument.create()
  doc.addPage([123, 456])
  const locked = await protectPdf(await doc.save(), {
    userPassword: 'secret',
    printing: true,
    copying: false,
    modifying: false,
  })
  await expect(PDFDocument.load(locked)).rejects.toThrow(/encrypted/)
  await expect(unlockPdf(locked, '')).rejects.toThrow('password-protected')
  await expect(unlockPdf(locked, 'nope')).rejects.toThrow('Wrong password')
  await expect(
    protectPdf(locked, { userPassword: 'x', printing: true, copying: true, modifying: true }),
  ).rejects.toThrow('password-protected')
  await expect(unlockPdf(new TextEncoder().encode('not a pdf'), '')).rejects.toThrow("can't find startxref")

  const open = await PDFDocument.load(await unlockPdf(locked, 'secret'))
  expect(open.getPage(0).getSize()).toEqual({ width: 123, height: 456 })
})
