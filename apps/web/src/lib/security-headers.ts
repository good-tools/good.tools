/** Grades a response's security headers. Weights sum to 100; a warning scores half. */

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface HeaderCheck {
  header: string
  status: CheckStatus
  value?: string
  note: string
  weight: number
}

export interface HeaderGrade {
  grade: string
  score: number
  checks: HeaderCheck[]
}

const HSTS_MIN = 15552000 // 180 days

/** Case-insensitive lookup; repeated headers are joined the way browsers combine them. */
export function headerValue(headers: Record<string, string[]>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key]?.join(', ') : undefined
}

/** The value of one CSP directive, or undefined if absent. */
export function cspDirective(csp: string, name: string): string | undefined {
  for (const part of csp.split(';')) {
    const [key, ...rest] = part.trim().split(/\s+/)
    if (key?.toLowerCase() === name) return rest.join(' ')
  }
  return undefined
}

function hsts(v: string | undefined, https: boolean): Omit<HeaderCheck, 'header' | 'weight'> {
  if (!https) return { status: 'fail', note: 'The final response is not served over HTTPS, so HSTS cannot apply.' }
  if (!v) return { status: 'fail', note: 'Missing: browsers may still try plain HTTP first, which can be intercepted.' }
  const age = Number(/max-age\s*=\s*"?(\d+)/i.exec(v)?.[1] ?? Number.NaN)
  if (!(age >= HSTS_MIN))
    return { status: 'warn', note: 'max-age is under 180 days (or missing); use at least 15552000, ideally a year.' }
  return { status: 'pass', note: /includesubdomains/i.test(v) ? 'Covers subdomains too.' : 'Set.' }
}

function csp(v: string | undefined, reportOnly: string | undefined): Omit<HeaderCheck, 'header' | 'weight'> {
  if (!v)
    return reportOnly
      ? {
          status: 'warn',
          note: 'Only Content-Security-Policy-Report-Only is set: violations are reported, not blocked.',
        }
      : { status: 'fail', note: 'Missing: no defence in depth against XSS and injected scripts.' }
  const scripts = cspDirective(v, 'script-src') ?? cspDirective(v, 'default-src')
  if (scripts === undefined)
    return { status: 'warn', note: 'No script-src or default-src, so scripts are unrestricted.' }
  if (/'unsafe-inline'/.test(scripts) && !/'nonce-|'sha(256|384|512)-|'strict-dynamic'/.test(scripts))
    return {
      status: 'warn',
      note: "Scripts allow 'unsafe-inline' without a nonce or hash, which weakens XSS protection.",
    }
  return { status: 'pass', note: 'Restricts where scripts can load from.' }
}

export function gradeHeaders(headers: Record<string, string[]>, https: boolean): HeaderGrade {
  const get = (n: string) => headerValue(headers, n)
  const checks: HeaderCheck[] = []
  const add = (header: string, weight: number, value: string | undefined, r: Omit<HeaderCheck, 'header' | 'weight'>) =>
    checks.push({ header, weight, value, ...r })

  add('Strict-Transport-Security', 25, get('strict-transport-security'), hsts(get('strict-transport-security'), https))

  const policy = get('content-security-policy')
  add('Content-Security-Policy', 25, policy, csp(policy, get('content-security-policy-report-only')))

  const xcto = get('x-content-type-options')
  add(
    'X-Content-Type-Options',
    10,
    xcto,
    xcto?.trim().toLowerCase() === 'nosniff'
      ? { status: 'pass', note: 'Browsers will not guess content types.' }
      : {
          status: 'fail',
          note: 'Should be "nosniff", or browsers may MIME-sniff a response into something executable.',
        },
  )

  const xfo = get('x-frame-options')
  const ancestors = policy && cspDirective(policy, 'frame-ancestors')
  add(
    'X-Frame-Options / frame-ancestors',
    15,
    ancestors ? `frame-ancestors ${ancestors}` : xfo,
    ancestors !== undefined && ancestors !== ''
      ? { status: 'pass', note: 'CSP frame-ancestors controls who may frame the page.' }
      : /^(deny|sameorigin)$/i.test(xfo?.trim() ?? '')
        ? { status: 'pass', note: 'Framing is restricted.' }
        : { status: 'fail', note: 'Missing: other sites can frame the page (clickjacking).' },
  )

  const referrer = get('referrer-policy')
  const lastReferrer = referrer?.split(',').pop()?.trim().toLowerCase() // the last valid token wins
  add(
    'Referrer-Policy',
    10,
    referrer,
    !referrer
      ? { status: 'warn', note: 'Missing: browsers default to strict-origin-when-cross-origin, but set it explicitly.' }
      : lastReferrer === 'unsafe-url' || lastReferrer === 'no-referrer-when-downgrade'
        ? { status: 'warn', note: 'Sends full URLs (paths and query strings) to other sites.' }
        : { status: 'pass', note: 'Limits what the Referer header leaks.' },
  )

  const permissions = get('permissions-policy')
  add(
    'Permissions-Policy',
    5,
    permissions,
    permissions
      ? { status: 'pass', note: 'Restricts browser features such as camera and geolocation.' }
      : { status: 'warn', note: 'Missing: embedded content may request powerful browser features.' },
  )

  const coop = get('cross-origin-opener-policy')
  add(
    'Cross-Origin-Opener-Policy',
    5,
    coop,
    coop && !/unsafe-none/i.test(coop)
      ? { status: 'pass', note: 'Isolates the browsing context from cross-origin popups.' }
      : { status: 'warn', note: 'Missing: cross-origin windows keep a reference to this one (XS-Leaks).' },
  )

  const coep = get('cross-origin-embedder-policy')
  add(
    'Cross-Origin-Embedder-Policy',
    5,
    coep,
    coep && /require-corp|credentialless/i.test(coep)
      ? { status: 'pass', note: 'Needed, with COOP, for cross-origin isolation.' }
      : { status: 'warn', note: 'Not set: only needed for cross-origin isolation (SharedArrayBuffer).' },
  )

  const score = checks.reduce(
    (s, c) => s + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight / 2 : 0),
    0,
  )
  const grade =
    score === 100 ? 'A+' : score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F'
  return { grade, score, checks }
}
