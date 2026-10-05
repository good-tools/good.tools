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
