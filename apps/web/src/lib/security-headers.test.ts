import { describe, expect, it } from 'vitest'
import { cspDirective, gradeHeaders, headerValue } from './security-headers'

const strict = {
  'Strict-Transport-Security': ['max-age=63072000; includeSubDomains; preload'],
  'Content-Security-Policy': ["default-src 'self'; frame-ancestors 'none'"],
  'X-Content-Type-Options': ['nosniff'],
  'Referrer-Policy': ['strict-origin-when-cross-origin'],
  'Permissions-Policy': ['camera=()'],
  'Cross-Origin-Opener-Policy': ['same-origin'],
  'Cross-Origin-Embedder-Policy': ['require-corp'],
}

const status = (h: Record<string, string[]>, header: string, https = true) =>
  gradeHeaders(h, https).checks.find((c) => c.header.startsWith(header))?.status

describe('gradeHeaders', () => {
  it('gives A+ to a fully hardened response', () => {
    const g = gradeHeaders(strict, true)
    expect(g.score).toBe(100)
    expect(g.grade).toBe('A+')
    expect(g.checks.every((c) => c.status === 'pass')).toBe(true)
  })

  it('fails a bare response and explains each header', () => {
    const g = gradeHeaders({}, true)
    expect(g.grade).toBe('F')
    expect(g.score).toBe(12.5) // only the half-credit warnings
    expect(g.checks).toHaveLength(8)
    for (const c of g.checks) expect(c.note).not.toBe('')
  })

  it('fails HSTS over plain HTTP and warns on a short max-age', () => {
    expect(status(strict, 'Strict', false)).toBe('fail')
    expect(status({ 'strict-transport-security': ['max-age=300'] }, 'Strict')).toBe('warn')
  })

  it('warns on unsafe-inline scripts unless a nonce or hash is present, and on report-only CSP', () => {
    expect(status({ 'Content-Security-Policy': ["script-src 'self' 'unsafe-inline'"] }, 'Content')).toBe('warn')
    expect(status({ 'Content-Security-Policy': ["script-src 'unsafe-inline' 'nonce-abc'"] }, 'Content')).toBe('pass')
    expect(status({ 'Content-Security-Policy-Report-Only': ["default-src 'self'"] }, 'Content')).toBe('warn')
    expect(status({ 'Content-Security-Policy': ['img-src *'] }, 'Content')).toBe('warn')
  })

  it('accepts X-Frame-Options or frame-ancestors for framing', () => {
    expect(status({ 'X-Frame-Options': ['SAMEORIGIN'] }, 'X-Frame')).toBe('pass')
    expect(status({ 'X-Frame-Options': ['ALLOW-FROM https://a.test'] }, 'X-Frame')).toBe('fail')
    expect(status({ 'Content-Security-Policy': ["frame-ancestors 'self'"] }, 'X-Frame')).toBe('pass')
  })

  it('warns on leaky referrer policies, using the last value', () => {
    expect(status({ 'Referrer-Policy': ['unsafe-url'] }, 'Referrer')).toBe('warn')
    expect(status({ 'Referrer-Policy': ['unsafe-url, no-referrer'] }, 'Referrer')).toBe('pass')
  })

  it('grades by score bands', () => {
    const { 'Content-Security-Policy': _, ...noCsp } = strict
    const g = gradeHeaders(noCsp, true) // CSP fail, frame-ancestors gone → framing fail
    expect(g.score).toBe(60)
    expect(g.grade).toBe('C')
  })
})

describe('helpers', () => {
  it('looks headers up case-insensitively and joins repeats', () => {
    expect(headerValue({ 'X-A': ['1', '2'] }, 'x-a')).toBe('1, 2')
    expect(headerValue({}, 'x-a')).toBeUndefined()
  })
  it('reads CSP directives', () => {
    expect(cspDirective("default-src 'self';  Frame-Ancestors 'none' ", 'frame-ancestors')).toBe("'none'")
    expect(cspDirective("default-src 'self'", 'script-src')).toBeUndefined()
  })
})
