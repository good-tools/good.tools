import { decodeJwt, timeValidity, verifyJwt } from './jwt'

// The jwt.io example token
const HS256 =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30'
const SECRET = 'a-string-secret-at-least-256-bits-long'

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)))

async function signed(alg: string, params: EcKeyGenParams | RsaHashedKeyGenParams, signAlg: AlgorithmIdentifier) {
  const keys = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair
  const input = `${enc({ alg, typ: 'JWT' })}.${enc({ sub: 'x' })}`
  const sig = await crypto.subtle.sign(signAlg, keys.privateKey, new TextEncoder().encode(input))
  const spki = await crypto.subtle.exportKey('spki', keys.publicKey)
  const pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(spki)))}\n-----END PUBLIC KEY-----`
  const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', keys.publicKey))
  return { token: `${input}.${b64url(sig)}`, pem, jwk }
}

describe('decodeJwt', () => {
  it('decodes header and payload', () => {
    const { header, payload } = decodeJwt(HS256)
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(payload).toEqual({ sub: '1234567890', name: 'John Doe', admin: true, iat: 1516239022 })
  })

  it('explains malformed tokens', () => {
    expect(() => decodeJwt('abc')).toThrow('3 dot-separated parts; this has 1')
    expect(() => decodeJwt('a.b.c.d.e')).toThrow('JWE')
    expect(() => decodeJwt('e30.!!!.x')).toThrow('Payload is not valid base64url')
    expect(() => decodeJwt('bm90IGpzb24.e30.')).toThrow('Header is not valid JSON')
  })
})

describe('verifyJwt', () => {
  it('verifies HS256 with the right secret only', async () => {
    expect(await verifyJwt(HS256, SECRET)).toBe(true)
    expect(await verifyJwt(HS256, 'wrong')).toBe(false)
  })

  it('accepts base64url-encoded secrets', async () => {
    const encoded = b64url(new TextEncoder().encode(SECRET))
    expect(await verifyJwt(HS256, encoded, { secretBase64Url: true })).toBe(true)
  })

  it('verifies ES256 with PEM and JWK keys', async () => {
    const { token, pem, jwk } = await signed('ES256', { name: 'ECDSA', namedCurve: 'P-256' }, {
      name: 'ECDSA',
      hash: 'SHA-256',
    } as EcdsaParams)
    expect(await verifyJwt(token, pem)).toBe(true)
    expect(await verifyJwt(token, jwk)).toBe(true)
    expect(await verifyJwt(`${token.slice(0, -4)}AAAA`, pem)).toBe(false)
  })

  it('verifies RS256', async () => {
    const { token, pem } = await signed(
      'RS256',
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      { name: 'RSASSA-PKCS1-v1_5' },
    )
    expect(await verifyJwt(token, pem)).toBe(true)
  })

  it('rejects private keys and alg none with a clear message', async () => {
    await expect(verifyJwt(HS256.replace(/^[^.]+/, enc({ alg: 'none' })), 'x')).rejects.toThrow('unsigned')
    const es = `${enc({ alg: 'ES256' })}.${enc({})}.AAAA`
    await expect(verifyJwt(es, '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----')).rejects.toThrow(
      'openssl pkey -pubout',
    )
  })
})

test('timeValidity', () => {
  expect(timeValidity({ exp: 100 }, 200)).toBe('expired')
  expect(timeValidity({ nbf: 300 }, 200)).toBe('not-yet-valid')
  expect(timeValidity({ exp: 300, nbf: 100 }, 200)).toBe('valid')
  expect(timeValidity({ sub: 'x' }, 200)).toBeNull()
})
