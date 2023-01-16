import React from 'react'

export const serviceBaseUrl = "https://api.good.tools"
export const internetToolsBaseUrl = "https://internet-tools.fly.dev"

export const tools = [
  // {
  //   title: 'Example Tool',
  //   href: '/example-tool',
  //   tags: ['example', 'tool'],
  //   component: React.lazy(() => import('./tools/ExampleTool')),
  //   description: "This is just an example tool",
  //   online: false,
  // },
  {
    title: 'Base64',
    href: '/base64',
    tags: ['base64', 'encoder', 'decoder'],
    component: React.lazy(() => import('./tools/Base64')),
    description: "Encode or decode text from and to the Base64 encoding format",
    online: false,
  },
  {
    title: 'URL Encoder/Decoder',
    href: '/url',
    tags: ['url', 'encoder', 'decoder'],
    component: React.lazy(() => import('./tools/URL')),
    description: "Encode or decode text from and to the URL encoding format",
    online: false,
  },
  {
    title: 'Diff Checker',
    href: '/diff-checker',
    tags: ['diff', 'text', 'checker'],
    component: React.lazy(() => import('./tools/DiffChecker')),
    description: "Compare text to find the difference between two text files",
    online: false,
    dependencies: [{
      name: "@monaco-editor/react",
      url: "https://www.npmjs.com/package/@monaco-editor/react"
    }]
  },
  {
    title: 'Certificate Decoder',
    href: '/certificate-decoder',
    tags: ['certificate', 'ssl', 'decoder'],
    component: React.lazy(() => import('./tools/CertificateDecoder')),
    description: "Decode PEM encoded X509 certificates",
    online: false,
    dependencies: [{
      name: "node-forge",
      url: "https://www.npmjs.com/package/node-forge"
    }],
  },
  {
    title: 'Protobuf Decoder',
    href: '/protobuf-decoder',
    tags: ['protobuf', 'decoder'],
    component: React.lazy(() => import('./tools/ProtobufDecoder')),
    description: "Read raw protobuf buffers and inspect field values",
    online: false,
    dependencies: [{
      name: "@goodtools/protobuf-decoder",
      url: "https://www.npmjs.com/package/@goodtools/protobuf-decoder"
    }],
  },
  {
    title: 'Java Object Deserializer',
    href: '/java-deserialize',
    tags: ['java', 'deserializer'],
    component: React.lazy(() => import('./tools/JavaDeserializer')),
    description: "Decode serialized Java objects and inspect their data",
    online: false,
    dependencies: [{
      name: "@goodtools/jdserialize",
      url: "https://www.npmjs.com/package/@goodtools/jdserialize"
    }, {
      name: "@monaco-editor/react",
      url: "https://www.npmjs.com/package/@monaco-editor/react"
    }, {
      name: "react-inspector",
      url: "https://www.npmjs.com/package/react-inspector"
    }]
  },
  {
    title: 'Docker Browser',
    href: '/docker-browser',
    tags: ['docker', 'image', 'browser', 'oci', 'container'],
    component: React.lazy(() => import('./tools/ImageBrowser')),
    description: "Inspect a docker image and its file system",
    online: true,
    dependencies: [{
      name: "containerd",
      url: "https://github.com/containerd/containerd"
    }, {
      name: "@monaco-editor/react",
      url: "https://www.npmjs.com/package/@monaco-editor/react"
    }]
  },
  {
    title: 'WHOIS',
    href: '/whois',
    tags: ['whois', 'lookup'],
    component: React.lazy(() => import('./tools/Whois')),
    description: "Search the whois database for verified registration information",
    online: true,
    dependencies: [{
      name: "likexian/whois",
      url: "https://github.com/likexian/whois"
    }]
  },
  {
    title: 'DNS Lookup',
    href: '/dns',
    tags: ['dns', 'lookup'],
    component: React.lazy(() => import('./tools/DNS')),
    description: "Lookup most common DNS record types for a domain",
    online: true,
    dependencies: [{
      name: "miekg/dns",
      url: "https://github.com/miekg/dns"
    }]
  },
  {
    title: 'Hash Calculator',
    href: '/hash',
    tags: ['hash', 'calculator', 'digest', 'md5', 'sha256', 'sha384', 'sha512'],
    component: React.lazy(() => import('./tools/HashCalculator')),
    description: "Calculate hashes for popular message digest algorithms",
    online: false,
    dependencies: [{
      name: "node-forge",
      url: "https://www.npmjs.com/package/node-forge"
    }],
  },
  {
    title: 'Whats My IP',
    href: '/whats-my-ip',
    tags: ['whats', 'my', 'ip', 'address'],
    component: React.lazy(() => import('./tools/WhatsMyIP')),
    description: "Find out your public IPv4 and IPv6 addresses",
    online: true,
  },
  {
    title: 'IP to Location',
    href: '/ip-location',
    tags: ['ip', 'address', 'location'],
    component: React.lazy(() => import('./tools/IP2Location')),
    description: "Lookup details about IP addresses including their location, ASN and more",
    online: true,
    dependencies: [{
      name: "oschwald/geoip2-golang",
      url: "https://github.com/oschwald/geoip2-golang"
    }, {
      name: "GeoLite2-City",
      url: "https://www.maxmind.com/en/geoip2-city"
    }, {
      name: "GeoLite2-ASN",
      url: "https://www.maxmind.com"
    }]
  },
  {
    title: 'JSON Formatter',
    href: '/json',
    tags: ['json', 'formatter'],
    component: React.lazy(() => import('./tools/JsonFormatter')),
    description: "Beautify and format a JSON document, filter values using JSONPath queries and browse your object tree",
    online: false,
    dependencies: [{
      name: "@monaco-editor/react",
      url: "https://www.npmjs.com/package/@monaco-editor/react"
    }, {
      name: "jsonpath",
    }, {
      name: "react-inspector",
      url: "https://www.npmjs.com/package/react-inspector"
    }]
  },
]
