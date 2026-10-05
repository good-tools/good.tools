import { afterEach, describe, expect, it, vi } from 'vitest'
import { getJSON, shortTTL } from './useApiQuery'

const mockFetch = (body: string, status: number) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, { status }))),
  )

afterEach(() => vi.unstubAllGlobals())

describe('getJSON', () => {
  it('returns parsed JSON and builds the query string', async () => {
    mockFetch('{"ip":"1.2.3.4"}', 200)
    await expect(getJSON('/ip', { ip: '1.2.3.4' }, 'fail', 'https://x')).resolves.toEqual({ ip: '1.2.3.4' })
    expect(fetch).toHaveBeenCalledWith('https://x/ip?ip=1.2.3.4')
  })

  it('uses the API message on error', async () => {
    mockFetch('{"message":"Invalid IP supplied"}', 400)
    await expect(getJSON('/ip', { ip: 'x' }, 'fail', 'https://x')).rejects.toThrow('Invalid IP supplied')
  })

  it('falls back on a non-JSON error body instead of a parse error', async () => {
    mockFetch('<html>Bad Gateway</html>', 502)
    await expect(getJSON('/dns', undefined, 'DNS lookup failed', 'https://x')).rejects.toThrow(
      'DNS lookup failed (HTTP 502)',
    )
  })
})

describe('shortTTL', () => {
  it('drops zero trailing units', () => {
    expect(['6h0m0s', '5m0s', '11m51s', '1h30m0s', '30s', '0s'].map(shortTTL)).toEqual([
      '6h',
      '5m',
      '11m51s',
      '1h30m',
      '30s',
      '0s',
    ])
  })
})
