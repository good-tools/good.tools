/**
 * Read and remove file metadata. ExifTool (WebAssembly) reads everything and strips images and media;
 * PDFs are stripped with pdf-lib (ExifTool's PDF edits are reversible) and Office files by rewriting docProps
 * (this ExifTool build has no ZIP support).
 */
import { PDFDict, PDFName, PDFRef, PDFStream } from '@cantoo/pdf-lib'
import { parseMetadata, writeMetadata } from '@uswriting/exiftool'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  type Hidden,
  imageEnd,
  parseEmbedded,
  pngText,
  recoverPng,
  trailingData,
  trailingJpeg,
} from '@/lib/hidden-data'
import { openPdf } from '@/lib/pdf'

/** Lets the browser fetch the wasm from our own URL (the package fetches ./zeroperl.wasm next to the page). */
export interface ExifToolLoader {
  fetch?: (...args: unknown[]) => Promise<Response>
}

export interface MetaGroup {
  name: string
  /** [sub-group, tag, value] */
  tags: [string, string, string][]
}

export interface Metadata {
  groups: MetaGroup[]
  /** Human-readable GPS position when the file carries one */
  location?: string
  /** Embedded previews, trailing bytes and PNG text (images only) */
  hidden?: Hidden
}

/** ExifTool's own bookkeeping and the WASI file system, not the file's metadata */
const HIDDEN = new Set(['ExifTool', 'System', 'Composite'])
const GROUP_NAMES: Record<string, string> = { PDF: 'PDF Info' }

/** ExifTool `-json -G0:1` output → display groups, File first, location pulled out. */
export function groupTags(json: Record<string, unknown>): Metadata {
  const groups = new Map<string, MetaGroup>()
  let location: string | undefined
  for (const [key, raw] of Object.entries(json)) {
    // "G0:G1:Tag", or "G0:Tag" when both families agree
    const parts = key.split(':')
    if (parts.length < 2) continue
    const tag = parts.at(-1) ?? ''
    const g0 = parts[0] ?? ''
    const g1 = parts.length > 2 ? (parts[1] ?? '') : g0
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw)
    if (/^GPS(Position|Coordinates)$/.test(tag)) location ??= value
    if (HIDDEN.has(g0) || HIDDEN.has(g1)) continue
    const name = g1 === 'GPS' ? 'GPS' : (GROUP_NAMES[g0] ?? g0)
    if (!groups.has(name)) groups.set(name, { name, tags: [] })
    groups.get(name)?.tags.push([g1 === g0 ? '' : g1, tag, value])
  }
  const sorted = [...groups.values()].sort((a, b) => Number(b.name === 'File') - Number(a.name === 'File'))
  return { groups: sorted, location }
}

export async function readMetadata(name: string, data: Uint8Array, loader: ExifToolLoader = {}): Promise<Metadata> {
  const res = await parseMetadata<Record<string, unknown>[]>(
    { name, data },
    { args: ['-json', '-G0:1', '-a'], transform: JSON.parse, ...loader },
  )
  if (!res.success) throw new Error(res.error || 'ExifTool could not read this file')
  const meta = groupTags(res.data[0] ?? {})
  if (isPdf(data)) return meta
  if (!isOffice(name, data)) {
    meta.hidden = await readHidden(name, data, loader)
    return meta
  }
  // ExifTool only sees the first ZIP entry here; show the document properties instead
  const props = officeProps(unzipSync(data, { filter: (f) => f.name.startsWith('docProps/') }))
  meta.groups = meta.groups.filter((g) => g.name !== 'ZIP').concat(props.tags.length ? [props] : [])
  return meta
}

async function readHidden(name: string, data: Uint8Array, loader: ExifToolLoader): Promise<Hidden> {
  // The "Preview" family: EXIF/IFD1 thumbnails, MPF images, Photoshop and XMP thumbnails, raw previews
  const res = await parseMetadata<Record<string, unknown>[]>(
    { name, data },
    { args: ['-json', '-b', '-a', '-G1', '-preview:all'], transform: JSON.parse, ...loader },
  )
  const images = res.success ? parseEmbedded(res.data[0] ?? {}) : []
  const trailing = trailingData(data)
  // MPF images live after the JPEG's end too; ExifTool already listed them
  const jpg = trailing && !images.some((i) => i.name.includes('MPImage')) ? trailingJpeg(trailing.data) : undefined
  if (jpg) images.push({ name: 'Trailing data:JPEG', data: jpg })
  return { images, trailing, text: pngText(data), recovery: recoverPng(data) }
}

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
const isOffice = (name: string, b: Uint8Array) => isZip(b) && /\.(docx|docm|xlsx|xlsm|pptx|pptm)$/i.test(name)
const isPdf = (b: Uint8Array) => new TextDecoder().decode(b.subarray(0, 1024)).includes('%PDF-')

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
const unescapeXml = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(Number(e[1] === 'x' ? `0${e.slice(1)}` : e.slice(1))) : (ENTITIES[e] ?? m),
  )

/** Text of docProps core/app elements and custom properties. Lists inside app.xml (vt:*) are skipped. */
export function officeProps(files: Record<string, Uint8Array>): MetaGroup {
  const tags: MetaGroup['tags'] = []
  for (const part of ['core', 'app', 'custom']) {
    const file = files[`docProps/${part}.xml`]
    if (!file) continue
    const re =
      part === 'custom'
        ? /<property\b[^>]*\bname="([^"]*)"[^>]*>\s*<vt:\w+>([^<]*)</g
        : /<(?!vt:)(?:\w+:)?(\w+)\b[^>]*>([^<]+)<\//g
    for (const [, tag = '', value = ''] of strFromU8(file).matchAll(re))
      if (value.trim()) tags.push([part, unescapeXml(tag), unescapeXml(value)])
  }
  return { name: 'Office properties', tags }
}

const NS = 'http://schemas.openxmlformats.org'
const VT = `xmlns:vt="${NS}/officeDocument/2006/docPropsVTypes"`
/** Empty but valid replacements, so no relationship or content type has to change */
const EMPTY_DOCPROPS: Record<string, string> = {
  'docProps/core.xml': `<cp:coreProperties xmlns:cp="${NS}/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>`,
  'docProps/app.xml': `<Properties xmlns="${NS}/officeDocument/2006/extended-properties" ${VT}/>`,
  'docProps/custom.xml': `<Properties xmlns="${NS}/officeDocument/2006/custom-properties" ${VT}/>`,
}

/** DOCX/XLSX/PPTX: blank the document properties. Comment and revision authors inside the content stay. */
export function stripOffice(bytes: Uint8Array): Uint8Array {
  const files = unzipSync(bytes)
  if (!files['[Content_Types].xml']) throw new Error('Not an Office (OOXML) document')
  for (const [path, xml] of Object.entries(EMPTY_DOCPROPS))
    if (files[path]) files[path] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`)
  return zipSync(files)
}

/** PDF: drop the Info dictionary and every XMP stream. Saving rewrites the file, so earlier revisions go too. */
export async function stripPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await openPdf(bytes, '', { updateMetadata: false })
  const ctx = doc.context
  if (ctx.trailerInfo.Info instanceof PDFRef) ctx.delete(ctx.trailerInfo.Info)
  ctx.trailerInfo.Info = undefined
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : undefined
    if (!dict) continue
    if (dict.lookup(PDFName.of('Type')) === PDFName.of('Metadata')) ctx.delete(ref)
    else dict.delete(PDFName.of('Metadata'))
  }
  return doc.save()
}

/**
 * Everything else goes through ExifTool, which edits the container in place: pixels and audio/video are never re-encoded.
 * Orientation and the ICC colour profile are kept, so the image still displays the same.
 */
async function stripWithExifTool(name: string, data: Uint8Array, loader: ExifToolLoader): Promise<Uint8Array> {
  const res = await writeMetadata(
    { name, data },
    {},
    { args: ['-q', '-q', '-all=', '--icc_profile:all', '-tagsfromfile', '@', '-Orientation'], ...loader },
  )
  // ExifTool writes no output when there was nothing to remove
  if (res.success || /unchanged|not found/i.test(res.error))
    return cutTrailing(res.success ? new Uint8Array(res.data) : data)
  throw new Error(res.error.replace(/^Error:\s*/, '').trim() || 'ExifTool could not write this file')
}

/** Drops anything after the end of the image, which ExifTool keeps for some formats */
function cutTrailing(b: Uint8Array): Uint8Array {
  const end = imageEnd(b)
  return end !== undefined && end < b.length ? b.slice(0, end) : b
}

export async function stripMetadata(name: string, data: Uint8Array, loader: ExifToolLoader = {}): Promise<Uint8Array> {
  if (isPdf(data)) return stripPdf(data)
  if (isOffice(name, data)) return stripOffice(data)
  return stripWithExifTool(name, data, loader)
}

/** `photo.jpg` → `photo-clean.jpg` */
export const cleanName = (name: string) => name.replace(/(\.[^./]+)?$/, (ext) => `-clean${ext}`)
