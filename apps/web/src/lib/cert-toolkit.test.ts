import * as x509 from '@peculiar/x509'
import { describe, expect, it } from 'vitest'
import {
  checkChain,
  createCsr,
  createSelfSigned,
  derToPem,
  EMPTY_SUBJECT,
  exportPrivateKeyPem,
  generateKeys,
  importPrivateKey,
  parseCertificates,
  parseSans,
  pemBlocks,
  pemToPkcs12,
  pkcs12ToPem,
  subjectName,
} from './cert-toolkit'

const EC = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }
const day = 86_400_000
const now = new Date('2026-06-01T00:00:00Z')

async function makeCa(name: string, issuer?: { name: string; keys: CryptoKeyPair }, notAfter = now.getTime() + day) {
  const keys = (await crypto.subtle.generateKey(EC, true, ['sign', 'verify'])) as CryptoKeyPair
  const cert = await x509.X509CertificateGenerator.create({
    subject: name,
    issuer: issuer?.name ?? name,
    publicKey: keys.publicKey,
    signingKey: (issuer?.keys ?? keys).privateKey,
    signingAlgorithm: EC,
    notBefore: new Date(now.getTime() - day),
    notAfter: new Date(notAfter),
    extensions: [new x509.BasicConstraintsExtension(true, undefined, true)],
  })
  return { name, keys, cert }
}

async function makeLeaf(issuer: { name: string; keys: CryptoKeyPair }) {
  const keys = (await crypto.subtle.generateKey(EC, true, ['sign', 'verify'])) as CryptoKeyPair
  const cert = await x509.X509CertificateGenerator.create({
    subject: 'CN=leaf.example',
    issuer: issuer.name,
    publicKey: keys.publicKey,
    signingKey: issuer.keys.privateKey,
    signingAlgorithm: EC,
    notBefore: new Date(now.getTime() - day),
    notAfter: new Date(now.getTime() + day),
  })
  return { keys, cert }
}

describe('subject and SANs', () => {
  it('orders subject fields and skips blanks', () => {
    expect(subjectName({ ...EMPTY_SUBJECT, CN: 'a.test', C: 'US', O: ' Acme ' })).toEqual([
      { C: ['US'] },
      { O: ['Acme'] },
      { CN: ['a.test'] },
    ])
  })

  it('splits DNS and IP SANs and rejects junk', () => {
    expect(parseSans('a.test, *.b.test\n10.0.0.1 ::1')).toEqual([
      { type: 'dns', value: 'a.test' },
      { type: 'dns', value: '*.b.test' },
      { type: 'ip', value: '10.0.0.1' },
      { type: 'ip', value: '::1' },
    ])
    expect(() => parseSans('bad name!')).toThrow(/not a valid/)
  })
})

describe('CSR and self-signed', () => {
  it('creates a CSR with SANs that verifies', async () => {
    const keys = await generateKeys('ec-p256')
    const pem = await createCsr({ subject: { ...EMPTY_SUBJECT, CN: 'a.test' }, sans: 'a.test 10.0.0.1', keys })
    const csr = new x509.Pkcs10CertificateRequest(pem)
    expect(csr.subject).toBe('CN=a.test')
    expect(await csr.verify()).toBe(true)
    const san = new x509.SubjectAlternativeNameExtension(csr.getExtension('2.5.29.17')!.rawData)
    expect(san.names.items.map((n) => n.value)).toEqual(['a.test', '10.0.0.1'])
  })

  it('rejects an empty subject and a bad country', async () => {
    const keys = await generateKeys('ec-p256')
    await expect(createCsr({ subject: EMPTY_SUBJECT, sans: '', keys })).rejects.toThrow(/common name/)
    await expect(createCsr({ subject: { ...EMPTY_SUBJECT, CN: 'x', C: 'USA' }, sans: '', keys })).rejects.toThrow(
      /two-letter/,
    )
  })

  it('creates a self-signed cert with the requested validity', async () => {
    const keys = await generateKeys('rsa-2048')
    const pem = await createSelfSigned({ subject: { ...EMPTY_SUBJECT, CN: 'a.test' }, sans: '', keys, days: 30 }, now)
    const cert = new x509.X509Certificate(pem)
    expect(cert.notAfter.getTime() - cert.notBefore.getTime()).toBe(30 * day)
    expect(await cert.verify({ signatureOnly: true })).toBe(true)
  })

  it('round-trips a pasted key through PEM', async () => {
    const keys = await generateKeys('ec-p384')
    const imported = await importPrivateKey(await exportPrivateKeyPem(keys.privateKey))
    const pem = await createCsr({ subject: { ...EMPTY_SUBJECT, CN: 'k.test' }, sans: '', keys: imported })
    expect(await new x509.Pkcs10CertificateRequest(pem).verify()).toBe(true)
  })
})

describe('checkChain', () => {
  it('orders a shuffled chain and verifies every link', async () => {
    const root = await makeCa('CN=Root')
    const inter = await makeCa('CN=Inter', root)
    const leaf = await makeLeaf(inter)
    const r = await checkChain([root.cert, leaf.cert, inter.cert], now)
    expect(r.links.map((l) => l.role)).toEqual(['Leaf', 'Intermediate', 'Root'])
    expect(r.links.every((l) => l.signature && l.nameMatch !== false)).toBe(true)
    expect(r.rooted).toBe(true)
    expect(r.ok).toBe(true)
  })

  it('flags a missing issuer, expiry and unrelated certificates', async () => {
    const root = await makeCa('CN=Root')
    const inter = await makeCa('CN=Inter', root, now.getTime() - 1000)
    const leaf = await makeLeaf(inter)
    const stray = await makeCa('CN=Stray')
    const r = await checkChain([leaf.cert, inter.cert, stray.cert], now)
    expect(r.links.map((l) => l.role)).toEqual(['Leaf', 'Intermediate'])
    expect(r.links[1]!.signature).toBeNull()
    expect(r.links[1]!.inDate).toBe(false)
    expect(r.unused).toEqual([stray.cert])
    expect(r.rooted).toBe(false)
    expect(r.ok).toBe(false)
  })

  it('detects a bad signature from a same-named impostor issuer', async () => {
    const real = await makeCa('CN=Inter')
    const fake = await makeCa('CN=Inter')
    const leaf = await makeLeaf(real)
    const r = await checkChain([leaf.cert, fake.cert], now)
    expect(r.links[0]!.signature).toBe(false)
    expect(r.ok).toBe(false)
  })

  it('parses multiple PEM certificates', async () => {
    const a = await makeCa('CN=A')
    const b = await makeCa('CN=B')
    expect(parseCertificates(`${a.cert.toString('pem')}\n${b.cert.toString('pem')}`)).toHaveLength(2)
  })
})

describe('PEM / DER / PKCS#12', () => {
  it('labels DER blobs and round-trips PEM', async () => {
    const keys = await generateKeys('ec-p256')
    const cert = new x509.X509Certificate(
      await createSelfSigned({ subject: { ...EMPTY_SUBJECT, CN: 'a.test' }, sans: '', keys, days: 1 }),
    )
    expect(derToPem(cert.rawData)).toBe(cert.toString('pem'))
    expect(derToPem(await crypto.subtle.exportKey('pkcs8', keys.privateKey))).toMatch(/BEGIN PRIVATE KEY/)
    expect(derToPem(await crypto.subtle.exportKey('spki', keys.publicKey))).toMatch(/BEGIN PUBLIC KEY/)
    expect(() => derToPem(new Uint8Array([1, 2, 3]).buffer)).toThrow()
    expect(pemBlocks(cert.toString('pem'))[0]!.type).toBe('CERTIFICATE')
  })

  for (const type of ['ec-p256', 'rsa-2048'] as const)
    it(`builds and reads back a PKCS#12 bundle (${type})`, async () => {
      const keys = await generateKeys(type)
      const certPem = await createSelfSigned({ subject: { ...EMPTY_SUBJECT, CN: 'p.test' }, sans: '', keys, days: 1 })
      const keyPem = await exportPrivateKeyPem(keys.privateKey)
      const ca = await makeCa('CN=Extra')
      const p12 = await pemToPkcs12(`${ca.cert.toString('pem')}\n${keyPem}\n${certPem}`, 'sécret')
      const out = pkcs12ToPem(p12.slice().buffer, 'sécret')
      expect(out.certs[0]!.replace(/\s/g, '')).toBe(certPem.replace(/\s/g, ''))
      expect(out.certs).toHaveLength(2)
      expect(out.keys[0]!.replace(/\s/g, '')).toBe(keyPem.replace(/\s/g, ''))
      expect(() => pkcs12ToPem(p12.slice().buffer, 'wrong')).toThrow(/password/i)
    })

  it('refuses a key that matches none of the certificates', async () => {
    const keys = await generateKeys('ec-p256')
    const other = await makeCa('CN=Other')
    await expect(
      pemToPkcs12(`${await exportPrivateKeyPem(keys.privateKey)}\n${other.cert.toString('pem')}`, 'x'),
    ).rejects.toThrow(/doesn't match/)
  })
})
