/**
 * URL routes for all tools
 * Maps tool keys to URL paths
 */
export const ROUTES = {
  'base64-encoder-decoder': '/base64',
  'url-encoder-decoder': '/url',
  'diff-checker': '/diff-checker',
  'certificate-decoder': '/certificate-decoder',
  'protobuf-decoder': '/protobuf-decoder',
  'java-deserializer': '/java-deserialize',
  'docker-browser': '/docker-browser',
  whois: '/whois',
  'dns-lookup': '/dns',
  'hash-calculator': '/hash',
  'packet-dissector': '/packet-dissector',
  'whats-my-ip': '/whats-my-ip',
  'ip-location': '/ip-location',
  'json-formatter': '/json',
  'json-escape': '/json-escape',
  'xml-formatter': '/xml',
  'stl-repair': '/stl-repair',
} as const

export type ToolKey = keyof typeof ROUTES
export type ToolPath = (typeof ROUTES)[ToolKey]
