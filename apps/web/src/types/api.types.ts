/**
 * DNS record
 */
export interface DNSRecord {
  content: string
  /** Go duration string, e.g. "1m0s" */
  ttl: string
  priority: number
}

/**
 * DNS lookup response
 * Keys are record types (A, AAAA, CNAME, MX, etc.)
 */
export type DNSResponse = Record<string, DNSRecord[]>

/**
 * WHOIS response
 */
export interface WhoisResponse {
  data: string
}

/**
 * Caller's IP address (/my-ip)
 */
export interface MyIPResponse {
  ip: string
  user_agent: string
}

/**
 * IP location information
 */
export interface IPLocationResponse {
  ip: string
  continent?: string
  country?: string
  subdivisions?: string[]
  city?: string
  postal_code?: string
  time_zone: string
  location: {
    lat: number
    lng: number
    accuracy: number
  }
  traits: {
    anonymous_proxy: boolean
    satellite_provider: boolean
  }
  asn: {
    number: number
    organization: string
  }
  build: {
    city: string
    asn: string
  }
}

/**
 * Docker image metadata
 */
export interface DockerImageMetadata {
  name: string
  digest: string
  size: number
}

/**
 * Docker image config
 */
export interface DockerImageConfig {
  User?: string
  Entrypoint?: string[]
  Cmd?: string[]
  Env?: string[]
  Labels?: Record<string, string>
}

/**
 * Docker image details
 */
export interface DockerImageDetails {
  os: string
  architecture: string
  created: string
  config: DockerImageConfig
  rootfs?: {
    diff_ids?: string[]
  }
}

/**
 * Docker image response from image-browser API
 */
export interface DockerImageResponse {
  metadata: DockerImageMetadata
  image: DockerImageDetails
}

/**
 * Docker file node for file tree
 */
export interface DockerFileNode {
  id: string
  name: string
  directory: boolean
  size: number
  mode: string
  uid: number
  gid: number
  mime_type?: string
  symlink?: string
}

/**
 * Docker file list item (before processing)
 */
export interface DockerFileListItem {
  name: string
  directory: boolean
  size: number
  mode: string
  uid: number
  gid: number
  mime_type?: string
  symlink?: string
}

/** One certificate from the server's chain (/http-inspect), leaf first */
export interface InspectCert {
  subject: string
  issuer: string
  sans?: string[]
  not_before: string
  not_after: string
  days_left: number
  key: string
  signature: string
}

export interface InspectTLS {
  version: string
  cipher: string
  alpn?: string
  ocsp_stapled: boolean
  trusted: boolean
  verify_error?: string
  chain: InspectCert[]
}

/** One request/response of the redirect chain; timings in ms */
export interface InspectHop {
  url: string
  status: number
  proto: string
  location?: string
  remote_addr?: string
  timing: { dns: number; connect: number; tls: number; ttfb: number; total: number }
  headers: Record<string, string[]>
  tls?: InspectTLS
}

/** HTTP & TLS inspection (/http-inspect); error says why the chain stopped early */
export interface InspectResponse {
  hops: InspectHop[]
  error?: string
}
