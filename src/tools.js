import React from 'react'

export const serviceBaseUrl = "https://api.good.tools"
export const internetToolsBaseUrl = "https://internet-tools.fly.dev"

export const tools = [
  {
    title: 'Example Tool',
    href: '/example-tool',
    tags: ['example', 'tool'],
    component: React.lazy(() => import('./tools/ExampleTool')),
  },
  {
    title: 'Base64 Encoder and Decoder',
    href: '/base64',
    tags: ['base64', 'base', '64', 'encoder', 'decoder'],
    component: React.lazy(() => import('./tools/Base64')),
  },
  {
    title: 'Diff Checker',
    href: '/diff-checker',
    tags: ['diff', 'text', 'checker'],
    component: React.lazy(() => import('./tools/DiffChecker')),
  },
  {
    title: 'Certificate Decoder',
    href: '/certificate-decoder',
    tags: ['certificate', 'ssl', 'decoder'],
    component: React.lazy(() => import('./tools/CertificateDecoder')),
  },
  {
    title: 'Protobuf Decoder',
    href: '/protobuf-decoder',
    tags: ['protobuf', 'decoder'],
    component: React.lazy(() => import('./tools/ProtobufDecoder')),
  },
  {
    title: 'Java Object Deserializer',
    href: '/java-deserialize',
    tags: ['java', 'deserializer'],
    component: React.lazy(() => import('./tools/JavaDeserializer')),
  },
  {
    title: 'Docker Browser',
    href: '/docker-browser',
    tags: ['docker', 'image', 'browser', 'oci', 'container'],
    component: React.lazy(() => import('./tools/ImageBrowser')),
  },
  {
    title: 'WHOIS',
    href: '/whois',
    tags: ['whois', 'lookup'],
    component: React.lazy(() => import('./tools/Whois')),
  },
  {
    title: 'DNS Lookup',
    href: '/dns',
    tags: ['dns', 'lookup'],
    component: React.lazy(() => import('./tools/DNS')),
  },
  {
    title: 'Whats My IP',
    href: '/whats-my-ip',
    tags: ['whats', 'my', 'ip', 'address'],
    component: React.lazy(() => import('./tools/WhatsMyIP')),
  },
  {
    title: 'IP to Location',
    href: '/ip-location',
    tags: ['ip', 'address', 'location'],
    component: React.lazy(() => import('./tools/IP2Location')),
  },
  {
    title: 'JSON Formatter',
    href: '/json',
    tags: ['json', 'formatter'],
    component: React.lazy(() => import('./tools/JsonFormatter')),
  },
]
