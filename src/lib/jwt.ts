/** JWT decoding and signature verification with Web Crypto (no dependencies). */

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: unknown
  /** The three base64url segments as they appear in the token */
  parts: [string, string, string]
}

const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function base64UrlDecode(segment: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(segment)) throw new Error('contains characters that are not base64url')
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function decodeJsonSegment(segment: string, name: string): unknown {
  let text: string
  try {
    text = textDecoder.decode(base64UrlDecode(segment))
  } catch (e) {
    throw new Error(`${name} is not valid base64url: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${name} is not valid JSON`)
  }
}

/** Throws a descriptive Error for anything that isn't a structurally valid JWS compact token. */
export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split('.')
  if (parts.length === 5) throw new Error('This is an encrypted JWT (JWE); only signed tokens (JWS) can be decoded')
  if (parts.length !== 3) throw new Error(`A JWT has 3 dot-separated parts; this has ${parts.length}`)
  const [h, p, s] = parts as [string, string, string]
  const header = decodeJsonSegment(h, 'Header')
  if (typeof header !== 'object' || header === null || Array.isArray(header))
    throw new Error('Header must be a JSON object')
  const payload = decodeJsonSegment(p, 'Payload')
  if (s) base64UrlDecode(s) // validate alphabet
  return { header: header as Record<string, unknown>, payload, parts: [h, p, s] }
}

type KeyAlgorithm =
  | { name: 'HMAC'; hash: string }
  | { name: 'RSASSA-PKCS1-v1_5'; hash: string }
  | { name: 'RSA-PSS'; hash: string; saltLength: number }
  | { name: 'ECDSA'; hash: string; namedCurve: string }
  | { name: 'Ed25519' }

const ALGORITHMS: Record<string, KeyAlgorithm> = {
  HS256: { name: 'HMAC', hash: 'SHA-256' },
  HS384: { name: 'HMAC', hash: 'SHA-384' },
  HS512: { name: 'HMAC', hash: 'SHA-512' },
  RS256: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  RS384: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
  RS512: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
  PS256: { name: 'RSA-PSS', hash: 'SHA-256', saltLength: 32 },
  PS384: { name: 'RSA-PSS', hash: 'SHA-384', saltLength: 48 },
  PS512: { name: 'RSA-PSS', hash: 'SHA-512', saltLength: 64 },
  ES256: { name: 'ECDSA', hash: 'SHA-256', namedCurve: 'P-256' },
  ES384: { name: 'ECDSA', hash: 'SHA-384', namedCurve: 'P-384' },
  ES512: { name: 'ECDSA', hash: 'SHA-512', namedCurve: 'P-521' },
  EdDSA: { name: 'Ed25519' },
  Ed25519: { name: 'Ed25519' },
}

export const isHmac = (alg: unknown) => typeof alg === 'string' && alg.startsWith('HS')
export const isSupportedAlg = (alg: unknown): alg is string => typeof alg === 'string' && alg in ALGORITHMS

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const m = pem.match(/-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/)
  if (!m) throw new Error('Expected a PEM public key (-----BEGIN PUBLIC KEY-----) or a JWK')
  if (m[1] !== 'PUBLIC KEY')
    throw new Error(`Expected "BEGIN PUBLIC KEY" (SPKI); got "BEGIN ${m[1]}". Convert it with: openssl pkey -pubout`)
  const bin = atob(m[2]!.replace(/\s+/g, ''))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function importKey(alg: KeyAlgorithm, key: string, secretBase64Url: boolean): Promise<CryptoKey> {
  if (alg.name === 'HMAC') {
    const raw = secretBase64Url ? base64UrlDecode(key.trim()) : new TextEncoder().encode(key)
    return crypto.subtle.importKey('raw', raw, alg, false, ['verify'])
  }
  const trimmed = key.trim()
  if (trimmed.startsWith('{')) {
    let jwk: JsonWebKey
    try {
      jwk = JSON.parse(trimmed) as JsonWebKey
    } catch {
      throw new Error('Key looks like a JWK but is not valid JSON')
    }
    return crypto.subtle.importKey('jwk', jwk, alg, false, ['verify'])
  }
  return crypto.subtle.importKey('spki', pemToDer(trimmed), alg, false, ['verify'])
}

/** Verifies the token's signature. Resolves true/false; rejects with a readable Error for bad keys or algorithms. */
export async function verifyJwt(token: string, key: string, { secretBase64Url = false } = {}): Promise<boolean> {
  const { header, parts } = decodeJwt(token)
  const alg = header.alg
  if (alg === 'none') throw new Error('Token is unsigned (alg "none")')
  if (!isSupportedAlg(alg)) throw new Error(`Unsupported algorithm: ${String(alg)}`)
  const algorithm = ALGORITHMS[alg]!
  const cryptoKey = await importKey(algorithm, key, secretBase64Url)
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  return crypto.subtle.verify(algorithm, cryptoKey, base64UrlDecode(parts[2]), data)
}

/** Registered claims (RFC 7519) and common extras, for the claims table. */
export const CLAIM_NAMES: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expires at',
  nbf: 'Not before',
  iat: 'Issued at',
  jti: 'JWT ID',
  alg: 'Algorithm',
  typ: 'Type',
  kid: 'Key ID',
  cty: 'Content type',
  scope: 'Scope',
  azp: 'Authorized party',
  nonce: 'Nonce',
  email: 'Email',
  name: 'Name',
}

export const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time', 'updated_at'])

/** "expired" / "not yet valid" / "valid" based on exp and nbf (seconds since epoch). */
export function timeValidity(payload: unknown, now = Date.now() / 1000): 'expired' | 'not-yet-valid' | 'valid' | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { exp, nbf } = payload as { exp?: unknown; nbf?: unknown }
  if (typeof exp !== 'number' && typeof nbf !== 'number') return null
  if (typeof exp === 'number' && now >= exp) return 'expired'
  if (typeof nbf === 'number' && now < nbf) return 'not-yet-valid'
  return 'valid'
}
