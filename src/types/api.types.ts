/**
 * DNS record
 */
export interface DNSRecord {
  content: string;
  ttl?: number;
}

/**
 * DNS lookup response
 * Keys are record types (A, AAAA, CNAME, MX, etc.)
 */
export interface DNSResponse {
  [recordType: string]: DNSRecord[] | string | undefined;
  message?: string;
}

/**
 * WHOIS response
 */
export interface WhoisResponse {
  data: string;
  message?: string;
}

/**
 * IP address information from service API
 */
export interface IPAddressInfo {
  ip: string;
  agent: string;
}

/**
 * IP address information from internet-tools API
 */
export interface MyIPResponse {
  ip: string;
}

/**
 * IP location information
 */
export interface IPLocationResponse {
  ip: string;
  continent?: string;
  country?: string;
  subdivisions: string[];
  city?: string;
  postal_code?: string;
  time_zone: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  traits: {
    anonymous_proxy: boolean;
    satellite_provider: boolean;
  };
  asn: {
    number: number;
    organization: string;
  };
  build: {
    city: string;
    asn: string;
  };
  message?: string;
}

/**
 * Docker image metadata
 */
export interface DockerImageMetadata {
  name: string;
  digest: string;
  size: number;
}

/**
 * Docker image config
 */
export interface DockerImageConfig {
  User?: string;
  Entrypoint?: string[];
  Cmd?: string[];
  Env?: string[];
  Labels?: Record<string, string>;
}

/**
 * Docker image details
 */
export interface DockerImageDetails {
  os: string;
  architecture: string;
  created: string;
  config: DockerImageConfig;
  rootfs?: {
    diff_ids?: string[];
  };
}

/**
 * Docker image response from image-browser API
 */
export interface DockerImageResponse {
  metadata: DockerImageMetadata;
  image: DockerImageDetails;
  message?: string;
}

/**
 * Docker file node for file tree
 */
export interface DockerFileNode {
  id: string;
  name: string;
  directory: boolean;
  size: number;
  mode: string;
  uid: number;
  gid: number;
  mime_type?: string;
  symlink?: string;
}

/**
 * Docker file list item (before processing)
 */
export interface DockerFileListItem {
  name: string;
  directory: boolean;
  size: number;
  mode: string;
  uid: number;
  gid: number;
  mime_type?: string;
  symlink?: string;
  message?: string;
}
