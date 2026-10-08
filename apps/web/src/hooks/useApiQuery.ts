/**
 * React Query hooks for the good.tools API (services/api)
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { API_CONFIG } from '@/config/api.config'
import type { DNSResponse, InspectResponse, IPLocationResponse, MyIPResponse, WhoisResponse } from '@/types/api.types'

export const EXAMPLE_DOMAINS = ['facebook.com', 'good.tools', 'ronin.ae', 'gmail.com', 'apple.com', 'microsoft.com']

/**
 * GET `${base}${path}?params` and parse JSON. Non-2xx responses throw with the
 * API's `{ message }` when present, otherwise `fallbackMessage (HTTP status)`.
 */
export async function getJSON<T>(
  path: string,
  params: Record<string, string> | undefined,
  fallbackMessage: string,
  base: string = API_CONFIG.baseUrl,
): Promise<T> {
  const response = await fetch(`${base}${path}${params ? `?${new URLSearchParams(params)}` : ''}`)
  if (!response.ok) {
    let message: string | undefined
    try {
      message = ((await response.json()) as { message?: string }).message
    } catch {
      // non-JSON error body (e.g. proxy 502 page)
    }
    throw new Error(message || `${fallbackMessage} (HTTP ${response.status})`)
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new Error(`${fallbackMessage}: invalid response`)
  }
}

/** Go duration string "6h0m0s" → "6h", "5m0s" → "5m", "11m51s" unchanged. */
export const shortTTL = (ttl: string) => ttl.replace(/(\d[hm])0s$/, '$1').replace(/(\d+h)0m$/, '$1')

/** The submitted lookup value, synced to `?q=` so lookups are shareable. */
const lastQuery = new Map<string, string>()

/**
 * The submitted lookup lives in `?q=` so results are shareable. Coming back to the tool without `?q=`
 * (e.g. from the sidebar) restores the last lookup made in this session.
 */
export function useSubmittedQuery() {
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const fromUrl = params.get('q')
  const submitted = fromUrl ?? lastQuery.get(pathname) ?? ''

  useEffect(() => {
    if (fromUrl === null && submitted) setParams({ q: submitted }, { replace: true })
  }, [fromUrl, submitted, setParams])

  const submit = (value: string) => {
    lastQuery.set(pathname, value)
    setParams(value ? { q: value } : {}, { replace: true })
  }
  if (fromUrl !== null) lastQuery.set(pathname, fromUrl)
  return [submitted, submit] as const
}

export function useDNSQuery(domain: string) {
  return useQuery({
    queryKey: ['dns', domain],
    queryFn: () => getJSON<DNSResponse>('/dns', { domain }, 'DNS lookup failed'),
    enabled: !!domain,
    retry: 1,
  })
}

export function useWhoisQuery(domain: string) {
  return useQuery({
    queryKey: ['whois', domain],
    queryFn: () => getJSON<WhoisResponse>('/whois', { domain }, 'WHOIS lookup failed'),
    enabled: !!domain,
    retry: 1,
  })
}

export function useMyIPQuery() {
  return useQuery({
    queryKey: ['myip'],
    queryFn: () => getJSON<MyIPResponse>('/my-ip', undefined, 'Failed to fetch IP address'),
    retry: 1,
    staleTime: 1000 * 60 * 5,
  })
}

export function useIPLocationQuery(ip: string) {
  return useQuery({
    queryKey: ['iplocation', ip],
    queryFn: () => getJSON<IPLocationResponse>('/ip', { ip }, 'IP location lookup failed'),
    enabled: !!ip,
    retry: 1,
  })
}

export function useHTTPInspectQuery(url: string) {
  return useQuery({
    queryKey: ['http-inspect', url],
    queryFn: () => getJSON<InspectResponse>('/http-inspect', { url }, 'Inspection failed'),
    enabled: !!url,
    retry: false,
  })
}
