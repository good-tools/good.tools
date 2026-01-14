/**
 * DNS record types
 */
export type DNSRecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "MX"
  | "NS"
  | "TXT"
  | "SOA"
  | "SRV"
  | "PTR";

/**
 * DNS record
 */
export interface DNSRecord {
  type: DNSRecordType;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

/**
 * DNS lookup response
 */
export interface DNSResponse {
  records: DNSRecord[];
  error?: string;
}

/**
 * WHOIS response
 */
export interface WhoisResponse {
  raw: string;
  parsed?: {
    domain?: string;
    registrar?: string;
    createdDate?: string;
    expiryDate?: string;
    nameServers?: string[];
    status?: string[];
  };
  error?: string;
}

/**
 * IP address information
 */
export interface IPAddressInfo {
  ipv4?: string;
  ipv6?: string;
  error?: string;
}

/**
 * IP location information
 */
export interface IPLocationResponse {
  ip: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  asn?: number;
  asnOrganization?: string;
  error?: string;
}

/**
 * Docker image layer
 */
export interface DockerImageLayer {
  digest: string;
  size: number;
  mediaType: string;
}

/**
 * Docker image manifest
 */
export interface DockerImageManifest {
  name: string;
  tag: string;
  layers: DockerImageLayer[];
  config: {
    digest: string;
    size: number;
  };
}

/**
 * Docker file tree node
 */
export interface DockerFileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: DockerFileNode[];
}

/**
 * Docker image response
 */
export interface DockerImageResponse {
  manifest: DockerImageManifest;
  fileTree: DockerFileNode;
  error?: string;
}
