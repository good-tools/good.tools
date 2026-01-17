/**
 * API configuration for good.tools
 * Uses runtime config for Docker deployment flexibility
 */
import { runtimeConfig } from './runtime.config'

export const API_CONFIG = {
  /**
   * Base URL for internet tools API
   * Used for: DNS, WHOIS, IP location lookups, My IP
   */
  get internetToolsBaseUrl() {
    return runtimeConfig.INTERNET_TOOLS_URL
  },

  /**
   * Base URL for Docker image browser API
   * Used for: Docker image filesystem browsing
   */
  get imageBrowserUrl() {
    return runtimeConfig.IMAGE_BROWSER_URL
  },
} as const

/**
 * API endpoint helpers
 */
export const API_ENDPOINTS = {
  // Internet tools API endpoints
  dns: (domain: string, recordType: string) =>
    `${API_CONFIG.internetToolsBaseUrl}/dns?domain=${encodeURIComponent(domain)}&type=${recordType}`,

  whois: (domain: string) => `${API_CONFIG.internetToolsBaseUrl}/whois?domain=${encodeURIComponent(domain)}`,

  ipLocation: (ip: string) => `${API_CONFIG.internetToolsBaseUrl}/ip/${encodeURIComponent(ip)}`,

  myIP: () => `${API_CONFIG.internetToolsBaseUrl}/my-ip`,

  // Docker image browser API endpoints
  dockerImage: (image: string, tag: string) =>
    `${API_CONFIG.imageBrowserUrl}/image?name=${encodeURIComponent(image)}&tag=${encodeURIComponent(tag)}`,

  dockerFile: (image: string, tag: string, path: string) =>
    `${API_CONFIG.imageBrowserUrl}/file?name=${encodeURIComponent(
      image,
    )}&tag=${encodeURIComponent(tag)}&path=${encodeURIComponent(path)}`,
} as const
