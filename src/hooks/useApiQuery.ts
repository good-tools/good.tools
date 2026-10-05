/**
 * React Query hooks for the online (internet-tools) APIs
 */
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { API_CONFIG } from '@/config/api.config'
import type { DNSResponse, WhoisResponse, MyIPResponse, IPLocationResponse } from '@/types/api.types'

export const EXAMPLE_DOMAINS = ['facebook.com', 'good.tools', 'ronin.ae', 'gmail.com', 'apple.com', 'microsoft.com']

/**
 * GET `${base}${path}?params` and parse JSON. Non-2xx responses throw with the
 * API's `{ message }` when present, otherwise `fallbackMessage (HTTP status)`.
 */
export async function getJSON<T>(
  path: string,
  params: Record<string, string> | undefined,
  fallbackMessage: string,
  base: string = API_CONFIG.internetToolsBaseUrl,
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
export function useSubmittedQuery() {
  const [params, setParams] = useSearchParams()
  const submitted = params.get('q') ?? ''
  const submit = (value: string) => setParams(value ? { q: value } : {}, { replace: true })
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
