import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { DNSResponse } from '@/types/api.types'
import {
  bimiCheck,
  checkEmailSecurity,
  dkimChecks,
  dmarcCheck,
  expandSpf,
  type Lookup,
  mtaStsCheck,
  mxCheck,
  parseDkim,
  parseDmarc,
  parseSpf,
  rsaKeyBits,
  spfCheck,
  tlsRptCheck,
} from './email-security'

const rec = (content: string, priority = 0) => ({ content, ttl: '5m0s', priority })
/** Fake resolver: name → TXT strings, or a full response. Counts queries. */
function fakeDns(zone: Record<string, string[] | DNSResponse>) {
  const calls: string[] = []
  const lookup: Lookup = async (name) => {
    calls.push(name)
    const z = zone[name]
    if (!z) return {}
    return Array.isArray(z) ? { TXT: z.map((t) => rec(t)) } : z
  }
  return { lookup, calls }
}
const statuses = (c: { findings: { status: string; message: string }[] }) =>
  c.findings.map((f) => `${f.status}: ${f.message}`)

describe('parseSpf', () => {
  it('parses mechanisms, qualifiers and modifiers', () => {
    const p = parseSpf(
      'v=spf1 ip4:192.0.2.0/24 ip6:2001:db8::/32 a mx:mail.example.com/24 include:_spf.x.com ~all exp=e.x.com',
    )
    expect(p.errors).toEqual([])
    expect(p.terms.map((t) => [t.qualifier, t.name, t.value])).toEqual([
      ['+', 'ip4', '192.0.2.0/24'],
      ['+', 'ip6', '2001:db8::/32'],
      ['+', 'a', undefined],
      ['+', 'mx', 'mail.example.com'],
      ['+', 'include', '_spf.x.com'],
      ['~', 'all', undefined],
      [undefined, 'exp', 'e.x.com'],
    ])
  })

  it('rejects bad syntax', () => {
    const p = parseSpf('v=spf1 ip4:300.1.1.1 ip6:zz::1 include: foo:bar a:/x ip4:1.2.3.4/33 all:x')
    expect(p.errors).toEqual([
      'Invalid ip4 address "ip4:300.1.1.1"',
      'Invalid ip6 address "ip6:zz::1"',
      '"include" needs a domain: "include:"',
      'Unknown mechanism "foo:bar"',
      'Invalid domain in "a:/x"',
      'Invalid CIDR length in "a:/x"',
      'Invalid ip4 address "ip4:1.2.3.4/33"',
      '"all" takes no argument: "all:x"',
    ])
  })

  it('requires the version first', () => {
    expect(parseSpf('include:x.com -all').errors[0]).toBe('Record must start with "v=spf1"')
    expect(parseSpf('v=spf2 -all').errors[0]).toBe('Record must start with "v=spf1"')
  })

  it('warns about ptr, terms after all, ignored redirect, duplicate redirect', () => {
    expect(parseSpf('v=spf1 ptr -all a').warnings).toEqual([
      expect.stringContaining('"ptr" is deprecated'),
      '"a" comes after "all" and is never evaluated',
    ])
    expect(parseSpf('v=spf1 redirect=x.com -all').warnings).toEqual([
      '"redirect=" is ignored because the record has an "all" mechanism',
    ])
    expect(parseSpf('v=spf1 redirect=a.com redirect=b.com').errors).toEqual(['"redirect=" appears more than once'])
  })

  it('accepts macros in domain specs', () => {
    expect(parseSpf('v=spf1 exists:%{i}._spf.%{d} -all').errors).toEqual([])
  })
})

describe('expandSpf lookup counter', () => {
  it('counts lookups recursively through include and redirect', async () => {
    const { lookup } = fakeDns({
      'example.com': { TXT: [rec('v=spf1 include:a.com mx redirect=r.com')], MX: [rec('mx.example.com', 10)] },
      'a.com': ['v=spf1 include:b.com a:host.a.com -all'],
      'b.com': ['v=spf1 ip4:192.0.2.1 -all'],
      'host.a.com': { A: [rec('192.0.2.2')] },
      'r.com': ['v=spf1 ip4:198.51.100.0/24 -all'],
    })
    const r = await expandSpf('example.com', lookup)
    // include:a.com, mx, redirect, include:b.com, a:host.a.com
    expect(r.lookups).toBe(5)
    expect(r.voids).toBe(0)
    expect(r.errors).toEqual([])
    expect(r.all).toBe('-') // from redirect
    expect(r.root.children.map((c) => [c.domain, c.via, c.lookups])).toEqual([
      ['a.com', 'include:a.com', 2],
      ['r.com', 'redirect=r.com', 0],
    ])
  })

  it('flags more than 10 lookups', async () => {
    const zone: Record<string, string[]> = { 'example.com': ['v=spf1 include:i0.com -all'] }
    for (let i = 0; i < 12; i++) zone[`i${i}.com`] = [`v=spf1 ${i < 11 ? `include:i${i + 1}.com` : ''} -all`]
    const r = await expandSpf('example.com', fakeDns(zone).lookup)
    expect(r.lookups).toBe(12)
    expect(statuses(spfCheck('example.com', zone['example.com']!, r))).toContain(
      'fail: 12 DNS lookups; the limit is 10, so SPF evaluates to permerror',
    )
  })

  it('stops expanding at the cap', async () => {
    const zone: Record<string, string[]> = { 'example.com': ['v=spf1 include:i0.com -all'] }
    for (let i = 0; i < 50; i++) zone[`i${i}.com`] = [`v=spf1 include:i${i + 1}.com -all`]
    const { lookup, calls } = fakeDns(zone)
    const r = await expandSpf('example.com', lookup)
    expect(r.lookups).toBe(21)
    expect(calls.length).toBeLessThan(50)
    expect(statuses(spfCheck('example.com', zone['example.com']!, r))[0]).toMatch(/^fail: 21\+ DNS lookups/)
  })

  it('counts void lookups', async () => {
    const r = await expandSpf(
      'example.com',
      fakeDns({ 'example.com': ['v=spf1 a:gone1.com mx:gone2.com include:gone3.com exists:gone4.com ~all'] }).lookup,
    )
    expect(r.lookups).toBe(4)
    expect(r.voids).toBe(4)
    expect(r.errors).toEqual(['include:gone3.com → gone3.com has no SPF record (permerror)'])
    expect(statuses(spfCheck('example.com', [], r))).toEqual([expect.stringContaining('fail: No SPF record')])
    expect(statuses(spfCheck('example.com', ['v=spf1 ~all'], r))).toContain(
      'fail: 4 void lookups (no answer); more than 2 is a permerror',
    )
  })

  it('does not count a redirect that "all" makes unreachable', async () => {
    const r = await expandSpf('x.com', fakeDns({ 'x.com': ['v=spf1 redirect=y.com -all'] }).lookup)
    expect(r.lookups).toBe(0)
  })

  it('detects include loops and multiple records in an include', async () => {
    const r = await expandSpf(
      'x.com',
      fakeDns({
        'x.com': ['v=spf1 include:y.com include:z.com -all'],
        'y.com': ['v=spf1 include:x.com -all'],
        'z.com': ['v=spf1 -all', 'v=spf1 ~all'],
      }).lookup,
    )
    expect(r.errors).toEqual([
      'include:x.com loops back to x.com',
      'z.com publishes 2 SPF records; there must be exactly one (permerror)',
    ])
  })

  it('does not resolve macro targets', async () => {
    const { lookup, calls } = fakeDns({ 'x.com': ['v=spf1 exists:%{i}.x.com -all'] })
    const r = await expandSpf('x.com', lookup)
    expect(r.lookups).toBe(1)
    expect(calls).toEqual(['x.com'])
  })
})

describe('spfCheck', () => {
  const check = async (record: string) =>
    statuses(spfCheck('x.com', [record], await expandSpf('x.com', fakeDns({ 'x.com': [record] }).lookup)))

  it('grades the all qualifier', async () => {
    expect(await check('v=spf1 +all')).toContain('fail: "+all" lets any server on the internet send as this domain')
    expect(await check('v=spf1 all')).toContain('fail: "+all" lets any server on the internet send as this domain')
    expect((await check('v=spf1 ?all')).join()).toContain('warn: "?all"')
    expect((await check('v=spf1 ~all')).join()).toContain('pass: "~all"')
    expect((await check('v=spf1 -all')).join()).toContain('pass: "-all"')
    expect((await check('v=spf1 ip4:192.0.2.1')).join()).toContain('warn: No "all" mechanism')
  })

  it('fails with multiple SPF records and ignores non-SPF TXT', () => {
    expect(spfCheck('x.com', ['v=spf1 -all', 'v=spf1 ~all', 'google-site-verification=abc']).status).toBe('fail')
    expect(spfCheck('x.com', ['v=spf10 -all', 'hello']).findings[0]?.message).toMatch(/^No SPF record/)
  })
})

describe('parseDmarc', () => {
  const msgs = (r: string) => statuses(parseDmarc(r))

  it('accepts a strict policy', () => {
    expect(msgs('v=DMARC1; p=reject; rua=mailto:dmarc@x.com; adkim=s; aspf=s; pct=100')).toEqual([
      'pass: p=reject: failing mail is rejected',
    ])
  })

  it('warns about p=none, pct<100, no rua, sp=none', () => {
    expect(msgs('v=DMARC1; p=none')).toEqual([
      expect.stringMatching(/^warn: p=none only monitors/),
      expect.stringMatching(/^warn: No rua/),
    ])
    expect(msgs('v=DMARC1; p=quarantine; sp=none; pct=50; rua=mailto:a@x.com')).toEqual([
      'pass: p=quarantine: failing mail goes to spam',
      'warn: sp=none leaves subdomains unprotected',
      'warn: pct=50: the policy applies to only 50% of failing mail',
    ])
  })

  it('fails on invalid values', () => {
    expect(
      msgs('v=DMARC1; p=block; sp=maybe; pct=150; adkim=x; aspf=y; rua=dmarc@x.com; ruf=mailto:f@x.com,https://x'),
    ).toEqual([
      'fail: Invalid policy p=block (use none, quarantine or reject)',
      'fail: Invalid subdomain policy sp=maybe',
      'fail: Invalid pct=150 (0-100)',
      'fail: Invalid adkim=x (use r or s)',
      'fail: Invalid aspf=y (use r or s)',
      'fail: Invalid rua address "dmarc@x.com"',
      'fail: Invalid ruf address "https://x"',
    ])
    expect(msgs('p=reject; v=DMARC1; rua=mailto:a@x.com')[0]).toBe('fail: Record must start with "v=DMARC1"')
    expect(msgs('v=DMARC1; rua=mailto:a@x.com')).toEqual(['fail: Missing the required "p" (policy) tag'])
  })

  it('accepts report size limits and multiple addresses', () => {
    expect(msgs('v=DMARC1;p=reject;rua=mailto:a@x.com!10m, mailto:b@y.com')).toHaveLength(1)
  })

  it('dmarcCheck handles missing and duplicate records', () => {
    expect(dmarcCheck('_dmarc.x.com', ['unrelated']).status).toBe('fail')
    expect(dmarcCheck('_dmarc.x.com', ['v=DMARC1; p=reject', 'v=DMARC1; p=none']).status).toBe('fail')
    expect(dmarcCheck('_dmarc.x.com', ['v=DMARC1; p=reject; rua=mailto:a@x.com']).status).toBe('pass')
  })
})

describe('DKIM', () => {
  const rsaKey = (bits: number, type: 'spki' | 'pkcs1' = 'spki') =>
    generateKeyPairSync('rsa', { modulusLength: bits }).publicKey.export({ type, format: 'der' }).toString('base64')

  it('reads RSA key sizes from SPKI and PKCS#1', () => {
    for (const bits of [512, 1024, 2048]) {
      expect(rsaKeyBits(Buffer.from(rsaKey(bits), 'base64'))).toBe(bits)
      expect(rsaKeyBits(Buffer.from(rsaKey(bits, 'pkcs1'), 'base64'))).toBe(bits)
    }
    expect(rsaKeyBits(new Uint8Array([0x30, 0x05, 0x02]))).toBeUndefined()
  })

  it('grades key length', () => {
    expect(statuses(parseDkim(`v=DKIM1; k=rsa; p=${rsaKey(2048)}`))).toEqual(['pass: RSA 2048-bit key'])
    expect(statuses(parseDkim(`v=DKIM1; p=${rsaKey(1024)}`))).toEqual(['warn: RSA 1024-bit key: rotate to 2048 bits'])
    expect(parseDkim(`p=${rsaKey(512)}`).findings[0]?.status).toBe('fail')
  })

  it('tolerates whitespace inside p= (multi-string TXT)', () => {
    const key = rsaKey(2048)
    expect(parseDkim(`v=DKIM1; p=${key.slice(0, 200)} ${key.slice(200)}`).bits).toBe(2048)
  })

  it('flags testing mode, revoked keys and bad keys', () => {
    const t = parseDkim(`v=DKIM1; t=s:y; p=${rsaKey(2048)}`)
    expect(t.testing).toBe(true)
    expect(t.findings.map((f) => f.status)).toEqual(['pass', 'warn'])
    expect(parseDkim('v=DKIM1; p=').revoked).toBe(true)
    expect(statuses(parseDkim('v=DKIM1; k=rsa'))).toEqual(['fail: Missing the required "p" (public key) tag'])
    expect(statuses(parseDkim('v=DKIM1; p=!!!'))).toEqual(['fail: "p=" is not valid base64'])
    expect(statuses(parseDkim('v=DKIM1; p=AAAA'))).toEqual(['fail: Could not read the RSA public key'])
    expect(statuses(parseDkim('k=rsa; v=DKIM1; p=')).at(0)).toBe('fail: "v" must be "DKIM1" and come first')
  })

  it('reads Ed25519 keys', () => {
    const spki = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' })
    const b64 = spki.subarray(-32).toString('base64')
    const p = parseDkim(`v=DKIM1; k=ed25519; p=${b64}`)
    expect([p.keyType, p.bits, p.findings[0]?.status]).toEqual(['ed25519', 256, 'pass'])
    expect(parseDkim('v=DKIM1; k=dsa; p=AAAA').findings[0]?.message).toBe('Unknown key type k=dsa')
  })

  it('dkimChecks warns when no selector has a key', () => {
    const [c] = dkimChecks('x.com', [{ selector: 'a', records: [] }], ['a'])
    expect(c?.status).toBe('warn')
    expect(c?.findings[0]?.message).toContain('(a)')
    expect(dkimChecks('x.com', [{ selector: 'a', records: ['hello'] }], ['a'])[0]?.status).toBe('fail')
  })
})

describe('other checks', () => {
  it('MX', () => {
    expect(mxCheck('x.com', { MX: [rec('b.x.com.', 20), rec('a.x.com.', 10)] }).records).toEqual([
      '10 a.x.com.',
      '20 b.x.com.',
    ])
    expect(mxCheck('x.com', { MX: [rec('.', 0)] }).status).toBe('info')
    expect(mxCheck('x.com', { A: [rec('192.0.2.1')] }).status).toBe('warn')
    expect(mxCheck('x.com', {}).status).toBe('fail')
  })

  it('MTA-STS, TLS-RPT', () => {
    expect(mtaStsCheck('_mta-sts.x.com', ['v=STSv1; id=2024-01-01']).status).toBe('fail')
    expect(mtaStsCheck('_mta-sts.x.com', ['v=STSv1; id=20240101']).status).toBe('pass')
    expect(mtaStsCheck('_mta-sts.x.com', []).status).toBe('warn')
    expect(tlsRptCheck('_smtp._tls.x.com', ['v=TLSRPTv1; rua=mailto:tls@x.com,https://r.x.com/v1']).status).toBe('pass')
    expect(tlsRptCheck('_smtp._tls.x.com', ['v=TLSRPTv1; rua=tls@x.com']).status).toBe('fail')
    expect(tlsRptCheck('_smtp._tls.x.com', []).status).toBe('info')
  })

  it('BIMI', () => {
    const ok = 'v=BIMI1; l=https://x.com/logo.svg; a=https://x.com/vmc.pem'
    expect(bimiCheck('default._bimi.x.com', [ok], 'reject').status).toBe('pass')
    expect(bimiCheck('default._bimi.x.com', [ok], 'none').status).toBe('warn')
    expect(bimiCheck('default._bimi.x.com', ['v=BIMI1; l=http://x.com/logo.png'], 'reject').status).toBe('fail')
    expect(bimiCheck('default._bimi.x.com', [], undefined).status).toBe('info')
  })
})

describe('checkEmailSecurity', () => {
  it('runs every check and queries each name once', async () => {
    const { lookup, calls } = fakeDns({
      'x.com': { TXT: [rec('v=spf1 include:_spf.x.com -all')], MX: [rec('mx.x.com.', 10)] },
      '_spf.x.com': ['v=spf1 ip4:192.0.2.0/24 -all'],
      '_dmarc.x.com': ['v=DMARC1; p=reject; rua=mailto:d@x.com'],
      'custom._domainkey.x.com': ['v=DKIM1; p='],
    })
    const checks = await checkEmailSecurity('X.com.', [' Custom ', 'bad name'], lookup)
    expect(checks.map((c) => [c.id, c.status])).toEqual([
      ['mx', 'pass'],
      ['spf', 'pass'],
      ['dmarc', 'pass'],
      ['dkim:custom', 'warn'],
      ['mta-sts', 'warn'],
      ['tls-rpt', 'info'],
      ['bimi', 'info'],
    ])
    expect(new Set(calls).size).toBe(calls.length)
    expect(calls).toContain('google._domainkey.x.com')
    expect(calls).not.toContain('bad name._domainkey.x.com')
  })
})
