/**
 * Email authentication checks (SPF, DKIM, DMARC, MX, MTA-STS, TLS-RPT, BIMI) over the good.tools
 * DNS endpoint. Everything here is pure apart from the injected `lookup`, so it is unit-tested with a fake resolver.
 */
import type { DNSResponse } from '@/types/api.types'

export type Status = 'pass' | 'warn' | 'fail' | 'info'
export interface Finding {
  status: Status
  message: string
}
export interface Check {
  id: string
  title: string
  status: Status
  /** DNS name that was queried */
  name: string
  records: string[]
  findings: Finding[]
  spf?: SpfNode
}

/** Resolves every common record type of a name (the `/dns` endpoint); no answers → `{}`. */
export type Lookup = (name: string) => Promise<DNSResponse>

export const COMMON_SELECTORS = ['google', 'selector1', 'selector2', 'default', 'k1', 's1', 'mail']

const RANK: Record<Status, number> = { info: 0, pass: 1, warn: 2, fail: 3 }
export const worst = (findings: Finding[], empty: Status = 'pass'): Status =>
  findings.reduce<Status>((w, f) => (RANK[f.status] > RANK[w] ? f.status : w), findings.length ? 'info' : empty)

const pass = (message: string): Finding => ({ status: 'pass', message })
const warn = (message: string): Finding => ({ status: 'warn', message })
const fail = (message: string): Finding => ({ status: 'fail', message })
const info = (message: string): Finding => ({ status: 'info', message })

const txt = (res: DNSResponse | undefined) => (res?.TXT ?? []).map((r) => r.content)
const startsWith = (record: string, version: string) =>
  record.toLowerCase() === version.toLowerCase() || record.toLowerCase().startsWith(`${version.toLowerCase()} `)
/** `v=DMARC1; p=none` → `{ v: 'DMARC1', p: 'none' }` (lower-cased keys, first occurrence wins). */
export function parseTags(record: string): Map<string, string> {
  const tags = new Map<string, string>()
  for (const part of record.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const key = part.slice(0, i).trim().toLowerCase()
    if (key && !tags.has(key)) tags.set(key, part.slice(i + 1).trim())
  }
  return tags
}
const versionTag = (record: string, version: string) => {
  const first = record.split(';')[0]?.replace(/\s+/g, '') ?? ''
  return first.toLowerCase() === `v=${version}`.toLowerCase()
}

// ---------------------------------------------------------------- SPF

export type Qualifier = '+' | '-' | '~' | '?'
export interface SpfTerm {
  raw: string
  /** Mechanism name or modifier name (lower-case) */
  name: string
  qualifier?: Qualifier
  /** Domain/IP argument without the CIDR suffix */
  value?: string
  modifier: boolean
}
export interface ParsedSpf {
  terms: SpfTerm[]
  errors: string[]
  warnings: string[]
}

const MECHANISMS = new Set(['all', 'include', 'a', 'mx', 'ptr', 'ip4', 'ip6', 'exists'])
/** Mechanisms and modifiers that cost a DNS lookup (RFC 7208 §4.6.4) */
export const LOOKUP_TERMS = new Set(['include', 'a', 'mx', 'ptr', 'exists', 'redirect'])

function validIp4(s: string) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/.exec(s)
  return !!m && m.slice(1, 5).every((o) => Number(o) <= 255) && (m[5] === undefined || Number(m[5]) <= 32)
}
function validIp6(s: string) {
  const [addr = '', cidr, extra] = s.split('/')
  if (extra !== undefined || !addr.includes(':') || (cidr !== undefined && !/^\d{1,3}$/.test(cidr))) return false
  if (cidr !== undefined && Number(cidr) > 128) return false
  try {
    new URL(`http://[${addr}]/`)
    return true
  } catch {
    return false
  }
}
const domainLike = (s: string) => /^[^\s/]+\.[^\s/]+$|%\{/.test(s)

/** Parses one SPF record's syntax (no DNS). */
export function parseSpf(record: string): ParsedSpf {
  const [version, ...rest] = record.trim().split(/\s+/)
  const out: ParsedSpf = { terms: [], errors: [], warnings: [] }
  if (version?.toLowerCase() !== 'v=spf1') out.errors.push('Record must start with "v=spf1"')
  const seen = new Set<string>()
  let afterAll = false
  for (const raw of rest) {
    const mod = /^([a-z][a-z0-9_.-]*)=(.*)$/i.exec(raw)
    if (mod) {
      const name = mod[1]!.toLowerCase()
      const value = mod[2]!
      if ((name === 'redirect' || name === 'exp') && seen.has(name))
        out.errors.push(`"${name}=" appears more than once`)
      if ((name === 'redirect' || name === 'exp') && !value) out.errors.push(`"${name}=" needs a domain`)
      seen.add(name)
      out.terms.push({ raw, name, value, modifier: true })
      continue
    }
    const m = /^([+\-~?]?)([a-z0-9]+)(?::([^/]*))?(\/.*)?$/i.exec(raw)
    const name = m?.[2]?.toLowerCase() ?? ''
    if (!m || !MECHANISMS.has(name)) {
      out.errors.push(`Unknown mechanism "${raw}"`)
      continue
    }
    const qualifier = (m[1] || '+') as Qualifier
    let value = m[3]
    const cidr = m[4]
    if (afterAll) out.warnings.push(`"${raw}" comes after "all" and is never evaluated`)
    if (name === 'all') {
      afterAll = true
      if (value !== undefined || cidr) out.errors.push(`"all" takes no argument: "${raw}"`)
    } else if (name === 'ip4' || name === 'ip6') {
      value = raw.slice(raw.indexOf(':') + 1)
      if (!(name === 'ip4' ? validIp4(value) : validIp6(value))) out.errors.push(`Invalid ${name} address "${raw}"`)
    } else if (name === 'include' || name === 'exists') {
      if (!value || !domainLike(value)) out.errors.push(`"${name}" needs a domain: "${raw}"`)
      if (cidr) out.errors.push(`"${name}" takes no CIDR length: "${raw}"`)
    } else {
      if (value !== undefined && !domainLike(value)) out.errors.push(`Invalid domain in "${raw}"`)
      if (cidr && !/^(\/\d{1,2})?(\/\/\d{1,3})?$/.test(cidr)) out.errors.push(`Invalid CIDR length in "${raw}"`)
      if (name === 'ptr')
        out.warnings.push('"ptr" is deprecated (RFC 7208 §5.5): slow and unreliable; list IPs instead')
    }
    out.terms.push({ raw, name, qualifier, value: value || undefined, modifier: false })
  }
  if (seen.has('redirect') && out.terms.some((t) => t.name === 'all'))
    out.warnings.push('"redirect=" is ignored because the record has an "all" mechanism')
  return out
}

/** Finds the SPF record(s) among a name's TXT records. */
export const spfRecords = (records: string[]) => records.filter((r) => startsWith(r.trim(), 'v=spf1'))

export interface SpfNode {
  domain: string
  /** via which term (`include:x`, `redirect=x`); undefined at the root */
  via?: string
  record?: string
  /** DNS lookups made by this record's own terms */
  lookups: number
  children: SpfNode[]
  error?: string
}
export interface SpfResult {
  root: SpfNode
  lookups: number
  voids: number
  errors: string[]
  warnings: string[]
  /** Effective `all` qualifier (following redirect), undefined when there is none */
  all?: Qualifier
}

export const SPF_LOOKUP_LIMIT = 10
export const SPF_VOID_LIMIT = 2
/** ponytail: stop expanding once this many lookups are counted; the record is already a permerror and this caps API calls. */
const EXPANSION_CAP = 20

const clean = (d: string) => d.toLowerCase().replace(/\.$/, '')

/** Recursively expands include/redirect, counting DNS lookups and void lookups (RFC 7208 §4.6.4). */
export async function expandSpf(domain: string, lookup: Lookup): Promise<SpfResult> {
  const res: SpfResult = { root: { domain, lookups: 0, children: [] }, lookups: 0, voids: 0, errors: [], warnings: [] }
  const visiting = new Set<string>()

  const walk = async (node: SpfNode, isRoot: boolean): Promise<Qualifier | undefined> => {
    const records = spfRecords(txt(await lookup(node.domain)))
    if (records.length === 0) {
      node.error = 'No SPF record'
      if (!isRoot) res.errors.push(`${node.via} → ${node.domain} has no SPF record (permerror)`)
      return undefined
    }
    if (records.length > 1) {
      node.error = 'Multiple SPF records'
      res.errors.push(`${node.domain} publishes ${records.length} SPF records; there must be exactly one (permerror)`)
      return undefined
    }
    node.record = records[0]
    const parsed = parseSpf(node.record)
    const at = isRoot ? '' : `${node.domain}: `
    res.errors.push(...parsed.errors.map((e) => at + e))
    res.warnings.push(...parsed.warnings.map((w) => at + w))
    visiting.add(node.domain)

    const hasAll = parsed.terms.find((t) => t.name === 'all')
    let all = hasAll?.qualifier
    for (const t of parsed.terms) {
      if (!LOOKUP_TERMS.has(t.name) || (t.name === 'redirect' && hasAll)) continue
      node.lookups++
      res.lookups++
      if (res.lookups > EXPANSION_CAP) return all
      const target = clean(t.value ?? node.domain)
      if (target.includes('%')) continue // macros expand per message, nothing to resolve here
      if (t.name === 'include' || t.name === 'redirect') {
        if (visiting.has(target)) {
          res.errors.push(`${t.raw} loops back to ${target}`)
          continue
        }
        const txts = txt(await lookup(target))
        if (txts.length === 0) res.voids++
        const child: SpfNode = { domain: target, via: t.raw, lookups: 0, children: [] }
        node.children.push(child)
        const childAll = await walk(child, false)
        if (t.name === 'redirect') all = childAll
      } else if (t.name === 'a' || t.name === 'mx' || t.name === 'exists') {
        const r = await lookup(target)
        if (t.name === 'mx') {
          const mx = r.MX ?? []
          if (mx.length === 0) res.voids++
          if (mx.length > 10) res.errors.push(`${t.raw}: ${target} has ${mx.length} MX hosts, more than 10 (permerror)`)
        } else if (!r.A?.length && (t.name === 'exists' || !r.AAAA?.length)) res.voids++
      }
    }
    visiting.delete(node.domain)
    return all
  }

  res.all = await walk(res.root, true)
  return res
}

export function spfCheck(domain: string, records: string[], expanded?: SpfResult): Check {
  const spf = spfRecords(records)
  const check: Check = { id: 'spf', title: 'SPF', status: 'pass', name: domain, records: spf, findings: [] }
  const f = check.findings
  if (spf.length === 0) {
    f.push(fail('No SPF record: receivers cannot tell which servers may send mail for this domain'))
  } else if (spf.length > 1) {
    f.push(fail(`${spf.length} SPF records found; RFC 7208 requires exactly one, so SPF evaluates to permerror`))
  } else if (expanded) {
    check.spf = expanded.root
    for (const e of expanded.errors) f.push(fail(e))
    for (const w of expanded.warnings) f.push(warn(w))
    const { lookups, voids, all } = expanded
    const capped = lookups > EXPANSION_CAP ? '+' : ''
    if (lookups > SPF_LOOKUP_LIMIT)
      f.push(fail(`${lookups}${capped} DNS lookups; the limit is ${SPF_LOOKUP_LIMIT}, so SPF evaluates to permerror`))
    else
      f.push(
        (lookups >= 8 ? warn : pass)(
          `${lookups} of ${SPF_LOOKUP_LIMIT} DNS lookups used${lookups >= 8 ? ' (close to the limit)' : ''}`,
        ),
      )
    if (voids > SPF_VOID_LIMIT)
      f.push(fail(`${voids} void lookups (no answer); more than ${SPF_VOID_LIMIT} is a permerror`))
    else if (voids > 0) f.push(warn(`${voids} void lookup${voids > 1 ? 's' : ''} (a name that returned no records)`))
    if (all === '+') f.push(fail('"+all" lets any server on the internet send as this domain'))
    else if (all === '?') f.push(warn('"?all" (neutral) gives no protection; use "~all" or "-all"'))
    else if (all === '~') f.push(pass('"~all": unlisted senders soft-fail'))
    else if (all === '-') f.push(pass('"-all": unlisted senders fail'))
    else f.push(warn('No "all" mechanism: unlisted senders get a neutral result; end the record with "~all" or "-all"'))
  }
  check.status = worst(f)
  return check
}

// ---------------------------------------------------------------- DMARC

export interface ParsedDmarc {
  tags: Map<string, string>
  findings: Finding[]
}

const mailtoList = (v: string) => v.split(',').map((u) => u.trim())
const validReportUri = (u: string) => /^mailto:[^@\s]+@[^@\s]+?(!\d+[kmgt]?)?$/i.test(u)

export function parseDmarc(record: string): ParsedDmarc {
  const tags = parseTags(record)
  const f: Finding[] = []
  if (!versionTag(record, 'DMARC1')) f.push(fail('Record must start with "v=DMARC1"'))
  const p = tags.get('p')?.toLowerCase()
  if (p === undefined) f.push(fail('Missing the required "p" (policy) tag'))
  else if (p === 'none')
    f.push(warn('p=none only monitors: spoofed mail is still delivered. Move to quarantine or reject'))
  else if (p === 'quarantine') f.push(pass('p=quarantine: failing mail goes to spam'))
  else if (p === 'reject') f.push(pass('p=reject: failing mail is rejected'))
  else f.push(fail(`Invalid policy p=${p} (use none, quarantine or reject)`))

  const sp = tags.get('sp')?.toLowerCase()
  if (sp !== undefined) {
    if (!['none', 'quarantine', 'reject'].includes(sp)) f.push(fail(`Invalid subdomain policy sp=${sp}`))
    else if (sp === 'none' && p && p !== 'none') f.push(warn('sp=none leaves subdomains unprotected'))
  }
  const pct = tags.get('pct')
  if (pct !== undefined) {
    if (!/^\d{1,3}$/.test(pct) || Number(pct) > 100) f.push(fail(`Invalid pct=${pct} (0-100)`))
    else if (Number(pct) < 100) f.push(warn(`pct=${pct}: the policy applies to only ${pct}% of failing mail`))
  }
  for (const key of ['adkim', 'aspf'] as const) {
    const v = tags.get(key)?.toLowerCase()
    if (v !== undefined && v !== 'r' && v !== 's') f.push(fail(`Invalid ${key}=${v} (use r or s)`))
  }
  const rua = tags.get('rua')
  if (!rua) f.push(warn('No rua: you get no aggregate reports about who sends mail as this domain'))
  for (const key of ['rua', 'ruf'] as const) {
    const v = tags.get(key)
    if (v) for (const u of mailtoList(v)) if (!validReportUri(u)) f.push(fail(`Invalid ${key} address "${u}"`))
  }
  if (tags.has('ri') && !/^\d+$/.test(tags.get('ri') ?? '')) f.push(fail(`Invalid ri=${tags.get('ri')}`))
  return { tags, findings: f }
}

export function dmarcCheck(name: string, records: string[]): Check {
  const dmarc = records.filter((r) => /^v\s*=\s*DMARC1/i.test(r.trim()))
  const check: Check = { id: 'dmarc', title: 'DMARC', status: 'pass', name, records: dmarc, findings: [] }
  if (dmarc.length === 0)
    check.findings.push(fail('No DMARC record: receivers have no policy for mail that fails SPF and DKIM'))
  else if (dmarc.length > 1) check.findings.push(fail(`${dmarc.length} DMARC records found; there must be exactly one`))
  else check.findings.push(...parseDmarc(dmarc[0]!).findings)
  check.status = worst(check.findings)
  return check
}

// ---------------------------------------------------------------- DKIM

export interface ParsedDkim {
  keyType: string
  /** Key size in bits; undefined when it can't be read */
  bits?: number
  testing: boolean
  revoked: boolean
  findings: Finding[]
}

/** Reads a DER TLV header at `pos` → content start and end. */
function tlv(b: Uint8Array, pos: number) {
  const tag = b[pos]
  let len = b[pos + 1] ?? 0
  let start = pos + 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + (b[start + i] ?? 0)
    start += n
  }
  if (start + len > b.length) throw new Error('truncated')
  return { tag, start, end: start + len }
}

/** RSA modulus size from a SubjectPublicKeyInfo or bare PKCS#1 RSAPublicKey. */
export function rsaKeyBits(der: Uint8Array): number | undefined {
  try {
    const outer = tlv(der, 0)
    let first = tlv(der, outer.start)
    if (first.tag === 0x30) {
      const bitString = tlv(der, first.end) // SPKI: algorithm, then BIT STRING
      if (bitString.tag !== 0x03) return undefined
      first = tlv(der, tlv(der, bitString.start + 1).start)
    }
    if (first.tag !== 0x02) return undefined
    let i = first.start
    while (i < first.end && der[i] === 0) i++
    if (i === first.end) return undefined
    return (first.end - i) * 8 - (Math.clz32(der[i]!) - 24)
  } catch {
    return undefined
  }
}

const base64Bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export function parseDkim(record: string): ParsedDkim {
  const tags = parseTags(record)
  const f: Finding[] = []
  if (tags.has('v') && !versionTag(record, 'DKIM1')) f.push(fail('"v" must be "DKIM1" and come first'))
  const keyType = (tags.get('k') ?? 'rsa').toLowerCase()
  const p = (tags.get('p') ?? '').replace(/\s+/g, '')
  const testing = (tags.get('t') ?? '').split(':').some((x) => x.trim().toLowerCase() === 'y')
  const out: ParsedDkim = { keyType, testing, revoked: false, findings: f }
  if (!tags.has('p')) f.push(fail('Missing the required "p" (public key) tag'))
  else if (!p) {
    out.revoked = true
    f.push(warn('Empty "p=": this key has been revoked'))
  } else {
    let der: Uint8Array | undefined
    try {
      der = base64Bytes(p)
    } catch {
      f.push(fail('"p=" is not valid base64'))
    }
    if (der && keyType === 'rsa') {
      out.bits = rsaKeyBits(der)
      if (out.bits === undefined) f.push(fail('Could not read the RSA public key'))
      else if (out.bits < 1024) f.push(fail(`RSA ${out.bits}-bit key: too short, receivers ignore it`))
      else if (out.bits < 2048) f.push(warn(`RSA ${out.bits}-bit key: rotate to 2048 bits`))
      else f.push(pass(`RSA ${out.bits}-bit key`))
    } else if (der && keyType === 'ed25519') {
      out.bits = der.length * 8
      f.push(der.length === 32 ? pass('Ed25519 key') : fail(`Ed25519 key must be 32 bytes, got ${der.length}`))
    } else if (der) f.push(fail(`Unknown key type k=${keyType}`))
  }
  if (testing) f.push(warn('t=y: testing mode, receivers treat signatures as unsigned'))
  return out
}

export function dkimChecks(domain: string, found: { selector: string; records: string[] }[], tried: string[]): Check[] {
  const checks = found
    .filter((s) => s.records.length)
    .map(({ selector, records }): Check => {
      const findings: Finding[] = []
      // a CNAME'd selector may carry unrelated TXT; prefer anything that looks like a key
      const keys = records.filter((r) => /(^|;)\s*(v\s*=\s*DKIM1|p\s*=)/i.test(r))
      if (keys.length === 0) findings.push(fail('TXT record found but it is not a DKIM key'))
      else if (keys.length > 1) findings.push(fail(`${keys.length} DKIM records for one selector`))
      else findings.push(...parseDkim(keys[0]!).findings)
      return {
        id: `dkim:${selector}`,
        title: `DKIM · ${selector}`,
        status: worst(findings),
        name: `${selector}._domainkey.${domain}`,
        records,
        findings,
      }
    })
  if (checks.length) return checks
  return [
    {
      id: 'dkim',
      title: 'DKIM',
      status: 'warn',
      name: `{selector}._domainkey.${domain}`,
      records: [],
      findings: [
        warn(`No DKIM key under the selectors tried (${tried.join(', ')}).`),
        info('Selectors cannot be listed through DNS; find yours in a received message’s DKIM-Signature "s=" tag'),
      ],
    },
  ]
}

// ---------------------------------------------------------------- MX, MTA-STS, TLS-RPT, BIMI

export function mxCheck(domain: string, res: DNSResponse): Check {
  const mx = [...(res.MX ?? [])].sort((a, b) => a.priority - b.priority)
  const records = mx.map((r) => `${r.priority} ${r.content}`)
  const f: Finding[] = []
  if (mx.length === 1 && (mx[0]!.content === '.' || mx[0]!.content === ''))
    f.push(info('Null MX (RFC 7505): this domain accepts no mail'))
  else if (mx.length === 0)
    f.push(
      res.A?.length || res.AAAA?.length
        ? warn('No MX record: senders fall back to the A/AAAA record')
        : fail('No MX record: this domain cannot receive mail'),
    )
  else f.push(pass(`${mx.length} mail server${mx.length > 1 ? 's' : ''}`))
  return { id: 'mx', title: 'MX', status: worst(f), name: domain, records, findings: f }
}

export function mtaStsCheck(name: string, records: string[]): Check {
  const sts = records.filter((r) => /^v\s*=\s*STSv1/i.test(r.trim()))
  const f: Finding[] = []
  if (sts.length === 0) f.push(warn('No MTA-STS record: senders may deliver over unencrypted or unverified TLS'))
  else if (sts.length > 1) f.push(fail(`${sts.length} MTA-STS records; there must be exactly one`))
  else {
    const tags = parseTags(sts[0]!)
    if (!versionTag(sts[0]!, 'STSv1')) f.push(fail('Record must start with "v=STSv1"'))
    const id = tags.get('id')
    if (!id) f.push(fail('Missing the required "id" tag'))
    else if (!/^[a-z0-9]{1,32}$/i.test(id)) f.push(fail(`Invalid id "${id}" (1-32 letters and digits)`))
    else f.push(pass(`Policy id ${id}`))
    f.push(
      info(`The policy itself is served at https://mta-sts.${name.replace(/^_mta-sts\./, '')}/.well-known/mta-sts.txt`),
    )
  }
  return { id: 'mta-sts', title: 'MTA-STS', status: worst(f), name, records: sts, findings: f }
}

export function tlsRptCheck(name: string, records: string[]): Check {
  const rpt = records.filter((r) => /^v\s*=\s*TLSRPTv1/i.test(r.trim()))
  const f: Finding[] = []
  if (rpt.length === 0) f.push(info('No TLS-RPT record: you get no reports about TLS delivery failures'))
  else if (rpt.length > 1) f.push(fail(`${rpt.length} TLS-RPT records; there must be exactly one`))
  else {
    const rua = parseTags(rpt[0]!).get('rua')
    if (!rua) f.push(fail('Missing the required "rua" tag'))
    else {
      const bad = rua.split(',').filter((u) => !/^(mailto:[^@\s]+@\S+|https:\/\/\S+)$/i.test(u.trim()))
      f.push(...(bad.length ? bad.map((u) => fail(`Invalid rua "${u.trim()}"`)) : [pass(`Reports go to ${rua}`)]))
    }
  }
  return { id: 'tls-rpt', title: 'TLS-RPT', status: worst(f), name, records: rpt, findings: f }
}

export function bimiCheck(name: string, records: string[], dmarcPolicy?: string): Check {
  const bimi = records.filter((r) => /^v\s*=\s*BIMI1/i.test(r.trim()))
  const f: Finding[] = []
  if (bimi.length === 0) f.push(info('No BIMI record (optional: shows your logo in supporting inboxes)'))
  else if (bimi.length > 1) f.push(fail(`${bimi.length} BIMI records; there must be exactly one`))
  else {
    const tags = parseTags(bimi[0]!)
    const l = tags.get('l')
    if (l === undefined) f.push(fail('Missing the "l" (logo) tag'))
    else if (l === '') f.push(info('Empty "l=": the domain declines to show a logo'))
    else if (!/^https:\/\/\S+\.svg$/i.test(l)) f.push(fail(`Logo must be an https:// SVG URL, got "${l}"`))
    else f.push(pass(`Logo: ${l}`))
    const a = tags.get('a')
    if (a && !/^https:\/\//i.test(a)) f.push(fail(`Certificate "a=" must be an https:// URL, got "${a}"`))
    if (!a) f.push(info('No VMC/CMC certificate ("a="): Gmail and Apple Mail require one to show the logo'))
    if (dmarcPolicy !== 'quarantine' && dmarcPolicy !== 'reject')
      f.push(warn('BIMI needs a DMARC policy of quarantine or reject'))
  }
  return { id: 'bimi', title: 'BIMI', status: worst(f), name, records: bimi, findings: f }
}

// ---------------------------------------------------------------- everything

export const validSelector = (s: string) => /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/i.test(s)

/** Runs every check. `lookup` is memoised here so each name is queried once. */
export async function checkEmailSecurity(domain: string, selectors: string[], rawLookup: Lookup): Promise<Check[]> {
  const cache = new Map<string, Promise<DNSResponse>>()
  const lookup: Lookup = (name) => {
    const key = clean(name)
    if (!cache.has(key)) cache.set(key, rawLookup(key))
    return cache.get(key)!
  }
  domain = clean(domain.trim())
  const tried = [
    ...new Set([...selectors.map((s) => s.trim().toLowerCase()).filter(validSelector), ...COMMON_SELECTORS]),
  ]
  const [root, dmarc, sts, rpt, bimi, ...dkim] = await Promise.all([
    lookup(domain),
    lookup(`_dmarc.${domain}`),
    lookup(`_mta-sts.${domain}`),
    lookup(`_smtp._tls.${domain}`),
    lookup(`default._bimi.${domain}`),
    ...tried.map((s) => lookup(`${s}._domainkey.${domain}`)),
  ])
  const rootTxt = txt(root)
  const expanded = spfRecords(rootTxt).length === 1 ? await expandSpf(domain, lookup) : undefined
  const dmarcCheckResult = dmarcCheck(`_dmarc.${domain}`, txt(dmarc))
  const policy = dmarcCheckResult.records.length === 1 ? parseTags(dmarcCheckResult.records[0]!).get('p') : undefined
  return [
    mxCheck(domain, root),
    spfCheck(domain, rootTxt, expanded),
    dmarcCheckResult,
    ...dkimChecks(
      domain,
      tried.map((selector, i) => ({ selector, records: txt(dkim[i]) })),
      tried,
    ),
    mtaStsCheck(`_mta-sts.${domain}`, txt(sts)),
    tlsRptCheck(`_smtp._tls.${domain}`, txt(rpt)),
    bimiCheck(`default._bimi.${domain}`, txt(bimi), policy?.toLowerCase()),
  ]
}
