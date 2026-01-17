/**
 * Custom React Query hooks for API calls
 */
import { useQuery } from '@tanstack/react-query'
import { API_CONFIG } from '@/config/api.config'
import type { DNSResponse, WhoisResponse, IPAddressInfo, MyIPResponse, IPLocationResponse } from '@/types/api.types'

/**
 * Hook for DNS lookups
 */
export function useDNSQuery(domain: string, enabled = false) {
  return useQuery<DNSResponse>({
    queryKey: ['dns', domain],
    queryFn: async () => {
      const response = await fetch(
        `${API_CONFIG.internetToolsBaseUrl}/dns?${new URLSearchParams({
          domain,
        })}`,
      )
      const data: unknown = await response.json()
      if (response.status >= 400 && response.status < 600) {
        throw new Error((data as { message: string }).message || 'DNS lookup failed')
      }
      return data as DNSResponse
    },
    enabled: enabled && !!domain,
    retry: 1,
  })
}

/**
 * Hook for WHOIS lookups
 */
export function useWhoisQuery(domain: string, enabled = false) {
  return useQuery<WhoisResponse>({
    queryKey: ['whois', domain],
    queryFn: async () => {
      const response = await fetch(
        `${API_CONFIG.internetToolsBaseUrl}/whois?${new URLSearchParams({
          domain,
        })}`,
      )
      const data: unknown = await response.json()
      if (response.status >= 400 && response.status < 600) {
        throw new Error((data as { message: string }).message || 'WHOIS lookup failed')
      }
      return data as WhoisResponse
    },
    enabled: enabled && !!domain,
    retry: 1,
  })
}

/**
 * Hook for getting user's IP address (v4)
 */
export function useMyIPQuery() {
  return useQuery<IPAddressInfo>({
    queryKey: ['myip', 'v4'],
    queryFn: async () => {
      const response = await fetch(`${API_CONFIG.internetToolsBaseUrl}/my-ip`)
      const data: unknown = await response.json()
      if (response.status >= 400 && response.status < 600) {
        throw new Error((data as { message: string }).message || 'Failed to fetch IP address')
      }
      return data as IPAddressInfo
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook for getting user's IP address (v6)
 */
export function useMyIPv6Query() {
  return useQuery<MyIPResponse>({
    queryKey: ['myip', 'v6'],
    queryFn: async () => {
      const response = await fetch(`${API_CONFIG.internetToolsBaseUrl}/my-ip`)
      const data: unknown = await response.json()
      if (response.status >= 400 && response.status < 600) {
        throw new Error((data as { message: string }).message || 'Failed to fetch IP address')
      }
      return data as MyIPResponse
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook for IP location lookups
 */
export function useIPLocationQuery(ip: string, enabled = false) {
  return useQuery<IPLocationResponse>({
    queryKey: ['iplocation', ip],
    queryFn: async () => {
      const response = await fetch(`${API_CONFIG.internetToolsBaseUrl}/ip?${new URLSearchParams({ ip })}`)
      const data: unknown = await response.json()
      if (response.status >= 400 && response.status < 600) {
        throw new Error((data as { message: string }).message || 'IP location lookup failed')
      }
      return data as IPLocationResponse
    },
    enabled: enabled && !!ip,
    retry: 1,
  })
}
