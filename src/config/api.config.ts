/**
 * API configuration for good.tools
 * Uses environment variables for different deployment environments
 */

export const API_CONFIG = {
  /**
   * Base URL for the good.tools service API
   * Used for: IP address detection
   */
  serviceBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.good.tools',

  /**
   * Base URL for internet tools API
   * Used for: DNS, WHOIS, IP location lookups
   */
  internetToolsBaseUrl: import.meta.env.VITE_INTERNET_TOOLS_URL || 'https://internet-tools.fly.dev',

  /**
   * Base URL for Docker image browser API
   * Used for: Docker image filesystem browsing
   */
  imageBrowserUrl: import.meta.env.VITE_IMAGE_BROWSER_URL || 'https://image-browser.fly.dev',

  /**
   * Google Analytics tracking ID
   */
  gaTrackingId: import.meta.env.VITE_GA_TRACKING_ID || 'G-XX2FY53B5V',
} as const

/**
 * API endpoint helpers
 */
export const API_ENDPOINTS = {
  // Service API endpoints
  ipAddress: () => `${API_CONFIG.serviceBaseUrl}/ip`,

  // Internet tools API endpoints
  dns: (domain: string, recordType: string) =>
    `${API_CONFIG.internetToolsBaseUrl}/dns?domain=${encodeURIComponent(domain)}&type=${recordType}`,

  whois: (domain: string) => `${API_CONFIG.internetToolsBaseUrl}/whois?domain=${encodeURIComponent(domain)}`,

  ipLocation: (ip: string) => `${API_CONFIG.internetToolsBaseUrl}/ip/${encodeURIComponent(ip)}`,

  // Docker image browser API endpoints
  dockerImage: (image: string, tag: string) =>
    `${API_CONFIG.imageBrowserUrl}/image?name=${encodeURIComponent(image)}&tag=${encodeURIComponent(tag)}`,

  dockerFile: (image: string, tag: string, path: string) =>
    `${API_CONFIG.imageBrowserUrl}/file?name=${encodeURIComponent(
      image,
    )}&tag=${encodeURIComponent(tag)}&path=${encodeURIComponent(path)}`,
} as const
