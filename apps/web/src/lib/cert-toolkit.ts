import * as x509 from '@peculiar/x509'
import forge from 'node-forge'

const { asn1, pki } = forge

// forge works on binary strings; WebCrypto and @peculiar/x509 on bytes
const toBin = (buf: ArrayBuffer | Uint8Array) => {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return s
}
const fromBin = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0))
const fromDer = (der: ArrayBuffer | Uint8Array) => asn1.fromDer(toBin(der))
const toDer = (obj: forge.asn1.Asn1) => fromBin(asn1.toDer(obj).getBytes())

/* ---------------------------------------------------------------- keys */

export type KeyType = 'rsa-2048' | 'rsa-3072' | 'rsa-4096' | 'ec-p256' | 'ec-p384'

export const KEY_TYPES: [KeyType, string][] = [
  ['rsa-2048', 'RSA 2048'],
  ['rsa-3072', 'RSA 3072'],
  ['rsa-4096', 'RSA 4096'],
  ['ec-p256', 'ECDSA P-256'],
  ['ec-p384', 'ECDSA P-384'],
]

const RSA = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
const CURVE_HASH: Record<string, string> = { 'P-256': 'SHA-256', 'P-384': 'SHA-384', 'P-521': 'SHA-512' }
const CURVE_OIDS: Record<string, string> = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
}
const RSA_OID = '1.2.840.113549.1.1.1'
const EC_OID = '1.2.840.10045.2.1'

export function generateKeys(type: KeyType): Promise<CryptoKeyPair> {
  const params = type.startsWith('rsa')
    ? { ...RSA, modulusLength: Number(type.slice(4)), publicExponent: new Uint8Array([1, 0, 1]) }
    : { name: 'ECDSA', namedCurve: type === 'ec-p256' ? 'P-256' : 'P-384' }
  return crypto.subtle.generateKey(params, true, ['sign', 'verify']) as Promise<CryptoKeyPair>
}

/** Converts a PKCS#8, PKCS#1 (RSA PRIVATE KEY) or SEC1 (EC PRIVATE KEY) PEM to PKCS#8 DER. */
export function privateKeyToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const block = x509.PemConverter.decodeWithHeaders(pem).find((b) => b.type.endsWith('PRIVATE KEY'))
  if (!block) throw new Error('No PEM private key found')
  switch (block.type) {
    case 'PRIVATE KEY':
      return new Uint8Array(block.rawData)
    case 'RSA PRIVATE KEY':
      return toDer(pki.wrapRsaPrivateKey(fromDer(block.rawData)))
    case 'EC PRIVATE KEY': {
      // ECPrivateKey ::= SEQUENCE { version, privateKey, [0] parameters (named curve OID), [1] publicKey }
      const params = (fromDer(block.rawData).value as forge.asn1.Asn1[]).find(
        (v) => v.tagClass === asn1.Class.CONTEXT_SPECIFIC && v.type === 0,
      )
      if (!params) throw new Error('EC private key does not name its curve')
      const curveOid = (params.value as forge.asn1.Asn1[])[0]!
      const oid = (o: string) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(o).getBytes())
      return toDer(
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, '\x00'),
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [oid(EC_OID), curveOid]),
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, toBin(block.rawData)),
        ]),
      )
    }
    case 'ENCRYPTED PRIVATE KEY':
      throw new Error('Encrypted private keys are not supported; decrypt it first (openssl pkey -in key.pem)')
    default:
      throw new Error(`Unsupported key type: ${block.type}`)
  }
}

/** Imports a PEM private key (RSA or EC) and derives its public key, so it can sign a CSR or certificate. */
export async function importPrivateKey(pem: string): Promise<CryptoKeyPair> {
  const pkcs8 = privateKeyToPkcs8(pem)
  // PrivateKeyInfo ::= SEQUENCE { version, AlgorithmIdentifier { algorithm, parameters }, privateKey }
  const alg = (fromDer(pkcs8).value as forge.asn1.Asn1[])[1]!.value as forge.asn1.Asn1[]
  const algOid = asn1.derToOid(alg[0]!.value as string)
  let params: RsaHashedImportParams | EcKeyImportParams
  if (algOid === RSA_OID) params = RSA
  else if (algOid === EC_OID) {
    const curve = CURVE_OIDS[asn1.derToOid(alg[1]?.value as string)]
    if (!curve) throw new Error('Unsupported EC curve (use P-256, P-384 or P-521)')
    params = { name: 'ECDSA', namedCurve: curve }
  } else throw new Error('Unsupported key algorithm (use an RSA or ECDSA key)')
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, params, true, ['sign'])
  const { d, p, q, dp, dq, qi, ...pub } = await crypto.subtle.exportKey('jwk', privateKey)
  const publicKey = await crypto.subtle.importKey('jwk', { ...pub, key_ops: ['verify'] }, params, true, ['verify'])
  return { privateKey, publicKey }
}

export async function exportPrivateKeyPem(key: CryptoKey) {
  return x509.PemConverter.encode(await crypto.subtle.exportKey('pkcs8', key), 'PRIVATE KEY')
}

function signingAlgorithm(key: CryptoKey) {
  const alg = key.algorithm as EcKeyAlgorithm | RsaHashedKeyAlgorithm
  return 'namedCurve' in alg ? { name: 'ECDSA', hash: CURVE_HASH[alg.namedCurve] } : alg
}

/* ------------------------------------------------------- CSR / self-signed */

export interface Subject {
  C: string
  ST: string
  L: string
  O: string
  OU: string
  CN: string
}

export const EMPTY_SUBJECT: Subject = { C: '', ST: '', L: '', O: '', OU: '', CN: '' }

/** Subject as an x509 JSON name, in the conventional C, ST, L, O, OU, CN order, skipping blank fields. */
export function subjectName(subject: Subject): x509.JsonName {
  return (Object.keys(EMPTY_SUBJECT) as (keyof Subject)[])
    .filter((k) => subject[k].trim())
    .map((k) => ({ [k]: [subject[k].trim()] }))
}

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/
const DNS_NAME = /^(\*\.)?[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*\.?$/i

/** Splits a comma/whitespace separated list into DNS and IP SANs. */
export function parseSans(text: string): x509.JsonGeneralName[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((value) => {
      if (IPV4.test(value) || value.includes(':')) return { type: 'ip', value }
      if (DNS_NAME.test(value)) return { type: 'dns', value }
      throw new Error(`"${value}" is not a valid DNS name or IP address`)
    })
}

export interface CertRequest {
  subject: Subject
  sans: string
  keys: CryptoKeyPair
}

function prepare({ subject, sans }: CertRequest) {
  const name = subjectName(subject)
  const names = parseSans(sans)
  if (!name.length && !names.length) throw new Error('Enter a common name or at least one SAN')
  if (subject.C.trim() && !/^[A-Za-z]{2}$/.test(subject.C.trim()))
    throw new Error('Country must be a two-letter code, e.g. US')
  return { name, sanExt: names.length ? [new x509.SubjectAlternativeNameExtension(names)] : [] }
}

export async function createCsr(req: CertRequest): Promise<string> {
  const { name, sanExt } = prepare(req)
  const csr = await x509.Pkcs10CertificateRequestGenerator.create({
    name,
    keys: req.keys,
    signingAlgorithm: signingAlgorithm(req.keys.privateKey),
    extensions: sanExt,
  })
  return csr.toString('pem')
}

export async function createSelfSigned(req: CertRequest & { days: number }, now = new Date()): Promise<string> {
  const { name, sanExt } = prepare(req)
  if (!Number.isInteger(req.days) || req.days < 1) throw new Error('Validity must be a whole number of days')
  const rsa = req.keys.privateKey.algorithm.name !== 'ECDSA'
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    name,
    keys: req.keys,
    notBefore: now,
    notAfter: new Date(now.getTime() + req.days * 86_400_000),
    signingAlgorithm: signingAlgorithm(req.keys.privateKey),
    extensions: [
      new x509.BasicConstraintsExtension(false, undefined, true),
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.digitalSignature | (rsa ? x509.KeyUsageFlags.keyEncipherment : 0),
        true,
      ),
      new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth, x509.ExtendedKeyUsage.clientAuth]),
      ...sanExt,
      await x509.SubjectKeyIdentifierExtension.create(req.keys.publicKey),
    ],
  })
  return cert.toString('pem')
}

/* ---------------------------------------------------------------- chain */

export function parseCertificates(pem: string): x509.X509Certificate[] {
  return x509.PemConverter.decodeWithHeaders(pem)
    .filter((b) => b.type === 'CERTIFICATE')
    .map((b) => new x509.X509Certificate(b.rawData))
}

export interface ChainLink {
  cert: x509.X509Certificate
  role: 'Leaf' | 'Intermediate' | 'Root' | 'Self-signed'
  /** Signature verifies with the next certificate's key (or its own for a root); null when the issuer is missing */
  signature: boolean | null
  /** Issuer name equals the next certificate's subject; null when the issuer is missing */
  nameMatch: boolean | null
  /** The issuing certificate has basicConstraints cA=true; null for a root or missing issuer */
  issuerIsCa: boolean | null
  inDate: boolean
}

export interface ChainResult {
  links: ChainLink[]
  /** Certificates that are not part of the leaf's chain */
  unused: x509.X509Certificate[]
  /** The chain ends at a self-signed certificate */
  rooted: boolean
  /** Every link checks out */
  ok: boolean
}

const selfIssued = (c: x509.X509Certificate) => c.subject === c.issuer

/**
 * Orders certificates from leaf to root by matching issuer and subject names, then checks each link
 * locally: signature, name chaining, CA flag and validity dates. No trust store or revocation lookups.
 */
export async function checkChain(certs: x509.X509Certificate[], now = new Date()): Promise<ChainResult> {
  if (!certs.length) throw new Error('Paste at least one certificate')
  // The leaf is the certificate that issued none of the others
  const leaf = certs.find((c) => !certs.some((o) => o !== c && !selfIssued(o) && o.issuer === c.subject)) ?? certs[0]!
  const chain = [leaf]
  for (let cur = leaf; !selfIssued(cur); ) {
    // ponytail: first name match wins; cross-signed bundles with two candidate issuers may pick the wrong one
    const next = certs.find((c) => !chain.includes(c) && c.subject === cur.issuer)
    if (!next) break
    chain.push(next)
    cur = next
  }

  const links = await Promise.all(
    chain.map(async (cert, i): Promise<ChainLink> => {
      const root = selfIssued(cert)
      const issuer = chain[i + 1] ?? (root ? cert : undefined)
      const signature = issuer ? await cert.verify({ publicKey: issuer, signatureOnly: true }).catch(() => false) : null
      const caExt = issuer && issuer !== cert ? issuer.getExtension(x509.BasicConstraintsExtension) : undefined
      return {
        cert,
        role: root ? (chain.length === 1 ? 'Self-signed' : 'Root') : i === 0 ? 'Leaf' : 'Intermediate',
        signature,
        nameMatch: issuer ? cert.issuer === issuer.subject : null,
        issuerIsCa: issuer && issuer !== cert ? !!caExt?.ca : null,
        inDate: now >= cert.notBefore && now <= cert.notAfter,
      }
    }),
  )
  const rooted = selfIssued(chain[chain.length - 1]!)
  return {
    links,
    unused: certs.filter((c) => !chain.includes(c)),
    rooted,
    ok: links.every((l) => l.signature !== false && l.nameMatch !== false && l.issuerIsCa !== false && l.inDate),
  }
}

/* ------------------------------------------------------------- PEM / DER */

/** PEM label for a DER blob: certificate, CSR, PKCS#8 private key or SubjectPublicKeyInfo. */
export function derLabel(der: ArrayBuffer): string {
  try {
    new x509.X509Certificate(der)
    return 'CERTIFICATE'
  } catch {}
  try {
    new x509.Pkcs10CertificateRequest(der)
    return 'CERTIFICATE REQUEST'
  } catch {}
  try {
    const parts = fromDer(der).value as forge.asn1.Asn1[]
    if (parts.length >= 3 && parts[0]!.type === asn1.Type.INTEGER && parts[2]!.type === asn1.Type.OCTETSTRING)
      return 'PRIVATE KEY'
    if (parts.length === 2 && parts[0]!.type === asn1.Type.SEQUENCE && parts[1]!.type === asn1.Type.BITSTRING)
      return 'PUBLIC KEY'
  } catch {}
  throw new Error('Not a DER certificate, CSR, PKCS#8 private key or public key')
}

export function derToPem(der: ArrayBuffer): string {
  return x509.PemConverter.encode(der, derLabel(der))
}

export function pemBlocks(pem: string) {
  return x509.PemConverter.decodeWithHeaders(pem).map((b) => ({ type: b.type, der: new Uint8Array(b.rawData) }))
}

/* --------------------------------------------------------------- PKCS#12 */

/** Extracts certificates and private keys from a PKCS#12 (.p12/.pfx) file as PEM. */
export function pkcs12ToPem(data: ArrayBuffer, password: string): { certs: string[]; keys: string[] } {
  let p12: forge.pkcs12.Pkcs12Pfx
  // forge passes one password string to both the MAC (as BMPString, correct) and PBES2 (as raw char codes);
  // PBES2 needs UTF-8 bytes, as OpenSSL writes them, so non-ASCII passwords work. Restored before returning.
  const pbe = (pki as unknown as { pbe: { getCipherForPBES2: (oid: string, params: unknown, pw: string) => unknown } })
    .pbe
  const getCipherForPBES2 = pbe.getCipherForPBES2
  pbe.getCipherForPBES2 = (oid, params, pw) => getCipherForPBES2(oid, params, forge.util.encodeUtf8(pw))
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(fromDer(data), false, password)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/password|MAC/i.test(msg)) throw new Error('Wrong password, or the file is corrupt')
    throw new Error(`Not a readable PKCS#12 file: ${msg}`)
  } finally {
    pbe.getCipherForPBES2 = getCipherForPBES2
  }
  const certs: string[] = []
  const keys: string[] = []
  for (const safe of p12.safeContents)
    for (const bag of safe.safeBags) {
      // forge only parses RSA keys and certs; other algorithms come back as raw ASN.1
      const raw = bag as forge.pkcs12.Bag & { asn1?: forge.asn1.Asn1 }
      if (bag.type === pki.oids.certBag) {
        const der = bag.cert ? asn1.toDer(pki.certificateToAsn1(bag.cert)).getBytes() : asn1.toDer(raw.asn1!).getBytes()
        certs.push(x509.PemConverter.encode(fromBin(der), 'CERTIFICATE'))
      } else if (bag.type === pki.oids.pkcs8ShroudedKeyBag || bag.type === pki.oids.keyBag) {
        const info = bag.key ? pki.wrapRsaPrivateKey(pki.privateKeyToAsn1(bag.key)) : raw.asn1!
        keys.push(x509.PemConverter.encode(toDer(info), 'PRIVATE KEY'))
      }
    }
  if (!certs.length && !keys.length) throw new Error('The PKCS#12 file holds no certificates or keys')
  return { certs, keys }
}

/**
 * Builds a PKCS#12 file from a private key and certificates (first = the key's certificate).
 * Uses AES-256-CBC/PBKDF2-SHA256 for the key and an HMAC-SHA256 MAC, which OpenSSL 3, Windows and macOS read.
 * Built by hand because forge's own builder only takes RSA keys.
 */
export function createPkcs12(keyPkcs8: Uint8Array, certs: Uint8Array[], password: string): Uint8Array {
  const count = 10_000
  const U = asn1.Class.UNIVERSAL
  const seq = (v: forge.asn1.Asn1[]) => asn1.create(U, asn1.Type.SEQUENCE, true, v)
  const set = (v: forge.asn1.Asn1[]) => asn1.create(U, asn1.Type.SET, true, v)
  // pki.oids is a string index, so entries type as possibly undefined
  const oid = (o: string | undefined) => asn1.create(U, asn1.Type.OID, false, asn1.oidToDer(o!).getBytes())
  const octets = (bytes: string) => asn1.create(U, asn1.Type.OCTETSTRING, false, bytes)
  const int = (n: number) => asn1.create(U, asn1.Type.INTEGER, false, asn1.integerToDer(n).getBytes())
  const explicit0 = (v: forge.asn1.Asn1) => asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [v])
  const dataInfo = (content: forge.asn1.Asn1) =>
    seq([oid(pki.oids.data), explicit0(octets(asn1.toDer(content).getBytes()))])

  const md = forge.md.sha1.create()
  md.update(toBin(certs[0]!))
  const attrs = set([seq([oid(pki.oids.localKeyId), set([octets(md.digest().getBytes())])])])

  const certBags = certs.map((der, i) =>
    seq([
      oid(pki.oids.certBag),
      explicit0(seq([oid(pki.oids.x509Certificate), explicit0(octets(toBin(der)))])),
      ...(i === 0 ? [attrs] : []),
    ]),
  )
  const keyBag = seq([
    oid(pki.oids.pkcs8ShroudedKeyBag),
    explicit0(
      // PBES2 takes the password as UTF-8 bytes (the MAC below uses forge's BMPString encoding)
      pki.encryptPrivateKeyInfo(fromDer(keyPkcs8), forge.util.encodeUtf8(password), {
        algorithm: 'aes256',
        count,
        prfAlgorithm: 'sha256',
      } as forge.pki.EncryptionOptions),
    ),
    attrs,
  ])
  const authSafe = seq([dataInfo(seq(certBags)), dataInfo(seq([keyBag]))])

  const salt = forge.random.getBytesSync(16)
  const macKey = forge.pkcs12.generateKey(
    password,
    forge.util.createBuffer(salt),
    3,
    count,
    32,
    forge.md.sha256.create(),
  )
  const hmac = forge.hmac.create()
  hmac.start('sha256', macKey.getBytes())
  hmac.update(asn1.toDer(authSafe).getBytes())
  const macData = seq([
    seq([seq([oid(pki.oids.sha256), asn1.create(U, asn1.Type.NULL, false, '')]), octets(hmac.digest().getBytes())]),
    octets(salt),
    int(count),
  ])
  return toDer(seq([int(3), dataInfo(authSafe), macData]))
}

/** Bundles a PEM private key and certificates into PKCS#12, putting the key's own certificate first. */
export async function pemToPkcs12(pem: string, password: string): Promise<Uint8Array> {
  const keyDer = privateKeyToPkcs8(pem)
  const certs = parseCertificates(pem)
  if (!certs.length) throw new Error('No certificate found')
  const { publicKey } = await importPrivateKey(pem)
  const spki = toBin(await crypto.subtle.exportKey('spki', publicKey))
  const own = certs.find((c) => toBin(c.publicKey.rawData) === spki)
  if (!own) throw new Error("The private key doesn't match any of the certificates")
  const ordered = [own, ...certs.filter((c) => c !== own)]
  return createPkcs12(
    keyDer,
    ordered.map((c) => new Uint8Array(c.rawData)),
    password,
  )
}
