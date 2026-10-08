// @vitest-environment node
// (ExifTool's wasm loads from disk under Node; in jsdom it would try to fetch it)
import { PDFDocument, PDFName } from '@cantoo/pdf-lib'
import { writeMetadata } from '@uswriting/exiftool'
import { Document, Packer, Paragraph } from 'docx'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import Vips from 'wasm-vips'
import { cleanName, groupTags, type Metadata, readMetadata, stripMetadata } from './metadata'

const tagsOf = (m: Metadata) => m.groups.flatMap((g) => g.tags.map(([, tag, value]) => `${g.name}:${tag}=${value}`))
const groupNames = (m: Metadata) => m.groups.map((g) => g.name)

async function taggedJpeg() {
  const vips = await Vips()
  const img = vips.Image.black(64, 32).add([200, 50, 50]).cast('uchar').copy({ interpretation: 'srgb' })
  const res = await writeMetadata(
    { name: 'a.jpg', data: img.writeToBuffer('.jpg') },
    {
      GPSLatitude: 48.8584,
      GPSLatitudeRef: 'N',
      GPSLongitude: 2.2945,
      GPSLongitudeRef: 'E',
      Make: 'Canon',
      Artist: 'Jane Doe',
      Orientation: 6,
      'XMP-dc:Creator': 'Jane Doe',
      'IPTC:Keywords': 'secret',
      Comment: 'hello',
    },
    { args: ['-n'] },
  )
  if (!res.success) throw new Error(res.error)
  return new Uint8Array(res.data)
}

/** Entropy-coded image data: everything from the start-of-scan marker on */
const scan = (jpg: Uint8Array) => {
  for (let i = 2; i < jpg.length - 1; i++) if (jpg[i] === 0xff && jpg[i + 1] === 0xda) return jpg.subarray(i)
  throw new Error('no SOS')
}

describe('groupTags', () => {
  it('groups by family, splits out GPS, hides ExifTool bookkeeping and finds the location', () => {
    const m = groupTags({
      SourceFile: '/a.jpg',
      'File:System:FileSize': '1 kB',
      'File:FileType': 'JPEG',
      'PDF:Author': 'Jane',
      'EXIF:IFD0:Make': 'Canon',
      'EXIF:GPS:GPSLatitude': '48 deg',
      'XMP:XMP-dc:Subject': ['a', 'b'],
      'Composite:Composite:GPSPosition': '48 deg N, 2 deg E',
    })
    expect(groupNames(m)).toEqual(['File', 'PDF Info', 'EXIF', 'GPS', 'XMP'])
    expect(m.groups[1]?.tags).toEqual([['', 'Author', 'Jane']])
    expect(m.groups[4]?.tags).toEqual([['XMP-dc', 'Subject', 'a, b']])
    expect(m.location).toBe('48 deg N, 2 deg E')
  })
})

describe('stripMetadata', () => {
  it('removes EXIF, GPS, XMP, IPTC and comments from a JPEG without touching the pixels', async () => {
    const jpg = await taggedJpeg()
    const before = await readMetadata('a.jpg', jpg)
    expect(before.location).toMatch(/48 deg/)
    expect(groupNames(before)).toEqual(expect.arrayContaining(['EXIF', 'GPS', 'XMP', 'IPTC']))

    const out = await stripMetadata('a.jpg', jpg)
    const after = await readMetadata('a.jpg', out)
    expect(after.location).toBeUndefined()
    expect(groupNames(after)).not.toEqual(expect.arrayContaining(['GPS']))
    expect(groupNames(after)).not.toContain('XMP')
    expect(groupNames(after)).not.toContain('IPTC')
    const tags = tagsOf(after).join('\n')
    expect(tags).not.toMatch(/Jane|Canon|secret|hello/)
    expect(tags).toContain('EXIF:Orientation=Rotate 90 CW') // kept, so the photo still shows upright
    expect(scan(out)).toEqual(scan(jpg)) // lossless: identical compressed image data
  }, 30_000)

  it('removes the Info dictionary and XMP from a PDF', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    doc.setAuthor('Jane Doe')
    doc.setTitle('Secret plan')
    doc.setProducer('Acme Writer')
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Jane Doe</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>`
    const stream = doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })
    doc.catalog.set(PDFName.of('Metadata'), doc.context.register(stream))
    const pdf = await doc.save()
    expect(tagsOf(await readMetadata('a.pdf', pdf)).join('\n')).toMatch(/Author=Jane Doe[\s\S]*Creator=Jane Doe/)

    const out = await stripMetadata('a.pdf', pdf)
    const after = await readMetadata('a.pdf', out)
    expect(tagsOf(after).join('\n')).not.toMatch(/Jane|Secret|Acme/)
    expect(groupNames(after)).not.toContain('XMP')
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1)
  }, 30_000)

  it('blanks the document properties of a DOCX', async () => {
    const docx = new Document({
      creator: 'Jane Doe',
      title: 'Secret plan',
      lastModifiedBy: 'Jane Doe',
      customProperties: [{ name: 'Client', value: 'Acme & Co' }],
      sections: [{ children: [new Paragraph('Body text')] }],
    })
    const bytes = new Uint8Array(await Packer.toBuffer(docx))
    const before = tagsOf(await readMetadata('a.docx', bytes))
    expect(before).toEqual(
      expect.arrayContaining([
        'Office properties:creator=Jane Doe',
        'Office properties:title=Secret plan',
        'Office properties:Client=Acme & Co',
      ]),
    )

    const out = await stripMetadata('a.docx', bytes)
    const after = await readMetadata('a.docx', out)
    expect(groupNames(after)).toEqual(['File'])
    const files = unzipSync(out)
    expect(Object.keys(files).sort()).toEqual(Object.keys(unzipSync(bytes)).sort()) // same parts, rels still valid
    expect(strFromU8(files['word/document.xml'] ?? new Uint8Array())).toContain('Body text')
  }, 30_000)

  it('returns the file unchanged when there is nothing to remove', async () => {
    const jpg = await stripMetadata('a.jpg', await taggedJpeg())
    const again = await stripMetadata('a.jpg', jpg)
    expect(tagsOf(await readMetadata('a.jpg', again))).toEqual(tagsOf(await readMetadata('a.jpg', jpg)))
  }, 30_000)
})

it('cleanName', () => {
  expect(cleanName('photo.jpg')).toBe('photo-clean.jpg')
  expect(cleanName('archive.tar.gz')).toBe('archive.tar-clean.gz')
  expect(cleanName('README')).toBe('README-clean')
})

it('strips files that have nothing to keep (no orientation)', async () => {
  const vips = await Vips()
  const png = vips.Image.black(8, 8).cast('uchar').writeToBuffer('.png', { keep: 'none' })
  const out = await stripMetadata('a.png', png)
  expect(groupNames(await readMetadata('a.png', out))).not.toContain('XMP')
}, 30_000)
