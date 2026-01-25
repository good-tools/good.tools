import React from 'react'
import {
  FileText,
  Link,
  GitCompare,
  FileKey,
  Package,
  Coffee,
  Container,
  Search,
  Globe,
  Hash,
  Radio,
  MapPin,
  Braces,
  Code2,
  Quote,
  Box,
  ImageIcon,
} from 'lucide-react'
import { ROUTES } from './routes.config'
import { CATEGORIES, type Tool } from '@/types/tool.types'
import { runtimeConfig } from '@/config/runtime.config'

export const tools: Tool[] = [
  {
    title: 'Base64',
    href: ROUTES['base64-encoder-decoder'],
    description: 'Encode or decode text from and to the Base64 encoding format',
    icon: FileText,
    categories: [CATEGORIES.ENCODING],
    searchTags: ['base64', 'encoder', 'decoder', 'encoding', 'decoding', 'text'],
    component: React.lazy(() => import('@/tools/Base64')),
    online: false,
  },
  {
    title: 'URL Encoder/Decoder',
    href: ROUTES['url-encoder-decoder'],
    description: 'Encode or decode text from and to the URL encoding format',
    icon: Link,
    categories: [CATEGORIES.ENCODING],
    searchTags: ['url', 'encoder', 'decoder', 'percent', 'encoding', 'uri'],
    component: React.lazy(() => import('@/tools/URL')),
    online: false,
  },
  {
    title: 'Diff Checker',
    href: ROUTES['diff-checker'],
    description: 'Compare text to find the difference between two text files',
    icon: GitCompare,
    categories: [CATEGORIES.DEVELOPMENT],
    searchTags: ['diff', 'text', 'checker', 'compare', 'difference'],
    component: React.lazy(() => import('@/tools/DiffChecker')),
    online: false,
    dependencies: [
      {
        name: '@monaco-editor/react',
        url: 'https://www.npmjs.com/package/@monaco-editor/react',
      },
    ],
  },
  {
    title: 'Certificate Decoder',
    href: ROUTES['certificate-decoder'],
    description: 'Decode PEM encoded X509 certificates',
    icon: FileKey,
    categories: [CATEGORIES.SECURITY],
    searchTags: ['certificate', 'ssl', 'tls', 'decoder', 'pem', 'x509', 'https'],
    component: React.lazy(() => import('@/tools/CertificateDecoder')),
    online: false,
    dependencies: [
      {
        name: '@peculiar/x509',
        url: 'https://www.npmjs.com/package/@peculiar/x509',
      },
    ],
  },
  {
    title: 'Protobuf Decoder',
    href: ROUTES['protobuf-decoder'],
    description: 'Read raw protobuf buffers and inspect field values',
    icon: Package,
    categories: [CATEGORIES.ENCODING, CATEGORIES.DEVELOPMENT],
    searchTags: ['protobuf', 'decoder', 'protocol', 'buffers', 'binary', 'grpc'],
    component: React.lazy(() => import('@/tools/ProtobufDecoder')),
    online: false,
    dependencies: [
      {
        name: '@goodtools/protobuf-decoder',
        url: 'https://www.npmjs.com/package/@goodtools/protobuf-decoder',
      },
    ],
  },
  {
    title: 'Java Object Deserializer',
    href: ROUTES['java-deserializer'],
    description: 'Decode serialized Java objects and inspect their data',
    icon: Coffee,
    categories: [CATEGORIES.SECURITY, CATEGORIES.DEVELOPMENT],
    searchTags: ['java', 'deserializer', 'serialization', 'object', 'inspect'],
    component: React.lazy(() => import('@/tools/JavaDeserializer')),
    online: false,
    dependencies: [
      {
        name: '@goodtools/jdserialize',
        url: 'https://www.npmjs.com/package/@goodtools/jdserialize',
      },
      {
        name: '@monaco-editor/react',
        url: 'https://www.npmjs.com/package/@monaco-editor/react',
      },
      {
        name: 'react-inspector',
        url: 'https://www.npmjs.com/package/react-inspector',
      },
    ],
  },
  {
    title: 'Docker Browser',
    href: ROUTES['docker-browser'],
    description: 'Inspect a docker image and its file system',
    icon: Container,
    categories: [CATEGORIES.DEVELOPMENT],
    searchTags: ['docker', 'image', 'browser', 'oci', 'container', 'filesystem', 'layers'],
    component: React.lazy(() => import('@/tools/ImageBrowser')),
    online: true,
    dependencies: [
      {
        name: 'containerd',
        url: 'https://github.com/containerd/containerd',
      },
      {
        name: '@monaco-editor/react',
        url: 'https://www.npmjs.com/package/@monaco-editor/react',
      },
    ],
  },
  {
    title: 'WHOIS',
    href: ROUTES['whois'],
    description: 'Search the whois database for verified registration information',
    icon: Search,
    categories: [CATEGORIES.NETWORK],
    searchTags: ['whois', 'lookup', 'domain', 'registration', 'owner'],
    component: React.lazy(() => import('@/tools/Whois')),
    online: true,
    dependencies: [
      {
        name: 'likexian/whois',
        url: 'https://github.com/likexian/whois',
      },
    ],
  },
  {
    title: 'DNS Lookup',
    href: ROUTES['dns-lookup'],
    description: 'Lookup most common DNS record types for a domain',
    icon: Globe,
    categories: [CATEGORIES.NETWORK],
    searchTags: ['dns', 'lookup', 'domain', 'records', 'a', 'aaaa', 'mx', 'cname', 'txt'],
    component: React.lazy(() => import('@/tools/DNS')),
    online: true,
    dependencies: [
      {
        name: 'miekg/dns',
        url: 'https://github.com/miekg/dns',
      },
    ],
  },
  {
    title: 'Hash Calculator',
    href: ROUTES['hash-calculator'],
    description: 'Calculate hashes for popular message digest algorithms',
    icon: Hash,
    categories: [CATEGORIES.SECURITY, CATEGORIES.ENCODING],
    searchTags: ['hash', 'calculator', 'digest', 'md5', 'sha256', 'sha384', 'sha512', 'checksum'],
    component: React.lazy(() => import('@/tools/HashCalculator')),
    online: false,
    dependencies: [
      {
        name: 'node-forge',
        url: 'https://www.npmjs.com/package/node-forge',
      },
    ],
  },
  {
    title: 'Packet Dissector',
    href: ROUTES['packet-dissector'],
    description: 'Wireshark packet dissection in your browser',
    icon: Radio,
    categories: [CATEGORIES.NETWORK, CATEGORIES.SECURITY],
    searchTags: ['wireshark', 'pcap', 'packet', 'dissector', 'network', 'capture', 'analysis'],
    component: React.lazy(() => import('@/tools/PacketDissector')),
    online: false,
    dependencies: [
      {
        name: '@goodtools/wiregasm',
        url: 'https://www.npmjs.com/package/@goodtools/wiregasm',
      },
    ],
    warning: function () {
      return <div>This tool uses a large (~18 MB) WASM binary for packet dissection in your browser.</div>
    },
  },
  {
    title: 'STL Repair',
    href: ROUTES['stl-repair'],
    description: 'Repair and fix STL mesh files for 3D printing - fill holes, fix normals, remove duplicates',
    icon: Box,
    categories: [CATEGORIES['3D']],
    searchTags: ['stl', 'mesh', 'repair', '3d', 'print', 'fix', 'holes', 'normals', 'manifold', 'cad'],
    component: React.lazy(() => import('@/tools/STLRepair')),
    online: false,
    dependencies: [
      {
        name: '@goodtools/meshrepair',
        url: 'https://www.npmjs.com/package/@goodtools/meshrepair',
      },
      {
        name: 'three.js',
        url: 'https://threejs.org',
      },
    ],
  },
  {
    title: 'Whats My IP',
    href: ROUTES['whats-my-ip'],
    description: 'Find out your public IPv4 and IPv6 addresses',
    icon: MapPin,
    categories: [CATEGORIES.NETWORK],
    searchTags: ['whats', 'my', 'ip', 'address', 'public', 'ipv4', 'ipv6'],
    component: React.lazy(() => import('@/tools/WhatsMyIP')),
    online: true,
  },
  {
    title: 'IP to Location',
    href: ROUTES['ip-location'],
    description: 'Lookup details about IP addresses including their location, ASN and more',
    icon: MapPin,
    categories: [CATEGORIES.NETWORK],
    searchTags: ['ip', 'address', 'location', 'geolocation', 'asn', 'city', 'country'],
    component: React.lazy(() => import('@/tools/IP2Location')),
    online: true,
    dependencies: [
      {
        name: 'oschwald/geoip2-golang',
        url: 'https://github.com/oschwald/geoip2-golang',
      },
      {
        name: 'GeoLite2-City',
        url: 'https://www.maxmind.com/en/geoip2-city',
      },
      {
        name: 'GeoLite2-ASN',
        url: 'https://www.maxmind.com',
      },
    ],
  },
  {
    title: 'JSON Formatter',
    href: ROUTES['json-formatter'],
    description:
      'Beautify and format a JSON document, filter values using JSONPath queries and browse your object tree',
    icon: Braces,
    categories: [CATEGORIES.DEVELOPMENT],
    searchTags: ['json', 'formatter', 'beautify', 'minify', 'jsonpath', 'validate'],
    component: React.lazy(() => import('@/tools/JsonFormatter')),
    online: false,
    dependencies: [
      {
        name: '@monaco-editor/react',
        url: 'https://www.npmjs.com/package/@monaco-editor/react',
      },
      {
        name: 'jsonpath',
      },
      {
        name: 'react-inspector',
        url: 'https://www.npmjs.com/package/react-inspector',
      },
    ],
  },
  {
    title: 'JSON Escape',
    href: ROUTES['json-escape'],
    description: 'Escape or unescape JSON special characters in text',
    icon: Quote,
    categories: [CATEGORIES.DEVELOPMENT],
    searchTags: ['json', 'escape', 'unescape', 'quotes', 'string', 'format'],
    component: React.lazy(() => import('@/tools/JsonEscape')),
    online: false,
  },
  {
    title: 'XML Formatter',
    href: ROUTES['xml-formatter'],
    description: 'Beautify and format an XML document, convert it to JSON or browse your object tree',
    icon: Code2,
    categories: [CATEGORIES.DEVELOPMENT],
    searchTags: ['xml', 'formatter', 'beautify', 'minify', 'convert', 'json'],
    component: React.lazy(() => import('@/tools/XmlFormatter')),
    online: false,
    dependencies: [
      {
        name: '@monaco-editor/react',
        url: 'https://www.npmjs.com/package/@monaco-editor/react',
      },
      {
        name: 'fast-xml-parser',
        url: 'https://www.npmjs.com/package/fast-xml-parser',
      },
      {
        name: 'xml-formatter',
        url: 'https://www.npmjs.com/package/xml-formatter',
      },
      {
        name: 'react-inspector',
        url: 'https://www.npmjs.com/package/react-inspector',
      },
    ],
  },
  {
    title: 'Image Converter',
    href: ROUTES['image-converter'],
    description: 'Convert images between formats: JPEG, PNG, WebP, AVIF with quality control',
    icon: ImageIcon,
    categories: [CATEGORIES.IMAGE],
    searchTags: ['image', 'convert', 'jpeg', 'png', 'webp', 'avif', 'format', 'photo'],
    component: React.lazy(() => import('@/tools/ImageConverter')),
    online: false,
    dependencies: [
      {
        name: 'wasm-vips',
        url: 'https://www.npmjs.com/package/wasm-vips',
      },
    ],
  },
]

/**
 * Filtered tools list based on DISABLE_ONLINE_TOOLS runtime config
 * When DISABLE_ONLINE_TOOLS is true, online tools are completely hidden
 */
export const filteredTools = runtimeConfig.DISABLE_ONLINE_TOOLS ? tools.filter((t) => !t.online) : tools
