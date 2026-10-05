/**
 * Where the online tools call the good.tools API (services/api). API_URL comes from the runtime
 * config (/config.js), so one build works against https://api.good.tools or a self-hosted /api.
 */
import { runtimeConfig } from './runtime.config'

export const API_CONFIG = {
  /** Versioned API base, e.g. https://api.good.tools/v1 */
  get baseUrl() {
    return `${runtimeConfig.API_URL.replace(/\/+$/, '')}/v1`
  },
} as const
