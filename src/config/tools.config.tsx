import React from "react";
import { ROUTES } from "./routes.config";
import type { Tool } from "@/types";

export const tools: Tool[] = [
  {
    title: "Base64",
    href: ROUTES["base64-encoder-decoder"],
    tags: ["base64", "encoder", "decoder"],
    component: React.lazy(() => import("@/tools/Base64")),
    description: "Encode or decode text from and to the Base64 encoding format",
    online: false,
  },
  {
    title: "URL Encoder/Decoder",
    href: ROUTES["url-encoder-decoder"],
    tags: ["url", "encoder", "decoder"],
    component: React.lazy(() => import("@/tools/URL")),
    description: "Encode or decode text from and to the URL encoding format",
    online: false,
  },
  {
    title: "Diff Checker",
    href: ROUTES["diff-checker"],
    tags: ["diff", "text", "checker"],
    component: React.lazy(() => import("@/tools/DiffChecker")),
    description: "Compare text to find the difference between two text files",
    online: false,
    dependencies: [
      {
        name: "@monaco-editor/react",
        url: "https://www.npmjs.com/package/@monaco-editor/react",
      },
    ],
  },
  {
    title: "Certificate Decoder",
    href: ROUTES["certificate-decoder"],
    tags: ["certificate", "ssl", "decoder"],
    component: React.lazy(() => import("@/tools/CertificateDecoder")),
    description: "Decode PEM encoded X509 certificates",
    online: false,
    dependencies: [
      {
        name: "node-forge",
        url: "https://www.npmjs.com/package/node-forge",
      },
    ],
  },
  {
    title: "Protobuf Decoder",
    href: ROUTES["protobuf-decoder"],
    tags: ["protobuf", "decoder"],
    component: React.lazy(() => import("@/tools/ProtobufDecoder")),
    description: "Read raw protobuf buffers and inspect field values",
    online: false,
    dependencies: [
      {
        name: "@goodtools/protobuf-decoder",
        url: "https://www.npmjs.com/package/@goodtools/protobuf-decoder",
      },
    ],
  },
  {
    title: "Java Object Deserializer",
    href: ROUTES["java-deserializer"],
    tags: ["java", "deserializer"],
    component: React.lazy(() => import("@/tools/JavaDeserializer")),
    description: "Decode serialized Java objects and inspect their data",
    online: false,
    dependencies: [
      {
        name: "@goodtools/jdserialize",
        url: "https://www.npmjs.com/package/@goodtools/jdserialize",
      },
      {
        name: "@monaco-editor/react",
        url: "https://www.npmjs.com/package/@monaco-editor/react",
      },
      {
        name: "react-inspector",
        url: "https://www.npmjs.com/package/react-inspector",
      },
    ],
  },
  {
    title: "Docker Browser",
    href: ROUTES["docker-browser"],
    tags: ["docker", "image", "browser", "oci", "container"],
    component: React.lazy(() => import("@/tools/ImageBrowser")),
    description: "Inspect a docker image and its file system",
    online: true,
    dependencies: [
      {
        name: "containerd",
        url: "https://github.com/containerd/containerd",
      },
      {
        name: "@monaco-editor/react",
        url: "https://www.npmjs.com/package/@monaco-editor/react",
      },
    ],
  },
  {
    title: "WHOIS",
    href: ROUTES["whois"],
    tags: ["whois", "lookup"],
    component: React.lazy(() => import("@/tools/Whois")),
    description:
      "Search the whois database for verified registration information",
    online: true,
    dependencies: [
      {
        name: "likexian/whois",
        url: "https://github.com/likexian/whois",
      },
    ],
  },
  {
    title: "DNS Lookup",
    href: ROUTES["dns-lookup"],
    tags: ["dns", "lookup"],
    component: React.lazy(() => import("@/tools/DNS")),
    description: "Lookup most common DNS record types for a domain",
    online: true,
    dependencies: [
      {
        name: "miekg/dns",
        url: "https://github.com/miekg/dns",
      },
    ],
  },
  {
    title: "Hash Calculator",
    href: ROUTES["hash-calculator"],
    tags: ["hash", "calculator", "digest", "md5", "sha256", "sha384", "sha512"],
    component: React.lazy(() => import("@/tools/HashCalculator")),
    description: "Calculate hashes for popular message digest algorithms",
    online: false,
    dependencies: [
      {
        name: "node-forge",
        url: "https://www.npmjs.com/package/node-forge",
      },
    ],
  },
  {
    title: "Packet Dissector",
    href: ROUTES["packet-dissector"],
    tags: ["wireshark", "pcap", "packet", "dissector"],
    component: React.lazy(() => import("@/tools/PacketDissector")),
    description: "Wireshark packet dissection in your browser",
    online: false,
    tag: "EXPERIMENTAL",
    dependencies: [
      {
        name: "@goodtools/wiregasm",
        url: "https://www.npmjs.com/package/@goodtools/wiregasm",
      },
    ],
    warning: function () {
      return (
        <div>
          This tool uses a large (~18 MB) WASM binary for packet dissection in
          your browser.
        </div>
      );
    },
  },
  {
    title: "Whats My IP",
    href: ROUTES["whats-my-ip"],
    tags: ["whats", "my", "ip", "address"],
    component: React.lazy(() => import("@/tools/WhatsMyIP")),
    description: "Find out your public IPv4 and IPv6 addresses",
    online: true,
  },
  {
    title: "IP to Location",
    href: ROUTES["ip-location"],
    tags: ["ip", "address", "location"],
    component: React.lazy(() => import("@/tools/IP2Location")),
    description:
      "Lookup details about IP addresses including their location, ASN and more",
    online: true,
    dependencies: [
      {
        name: "oschwald/geoip2-golang",
        url: "https://github.com/oschwald/geoip2-golang",
      },
      {
        name: "GeoLite2-City",
        url: "https://www.maxmind.com/en/geoip2-city",
      },
      {
        name: "GeoLite2-ASN",
        url: "https://www.maxmind.com",
      },
    ],
  },
  {
    title: "JSON Formatter",
    href: ROUTES["json-formatter"],
    tags: ["json", "formatter"],
    component: React.lazy(() => import("@/tools/JsonFormatter")),
    description:
      "Beautify and format a JSON document, filter values using JSONPath queries and browse your object tree",
    online: false,
    dependencies: [
      {
        name: "@monaco-editor/react",
        url: "https://www.npmjs.com/package/@monaco-editor/react",
      },
      {
        name: "jsonpath",
      },
      {
        name: "react-inspector",
        url: "https://www.npmjs.com/package/react-inspector",
      },
    ],
  },
  {
    title: "XML Formatter",
    href: ROUTES["xml-formatter"],
    tags: ["xml", "formatter"],
    component: React.lazy(() => import("@/tools/XmlFormatter")),
    description:
      "Beautify and format an XML document, convert it to JSON or browse your object tree",
    online: false,
    dependencies: [
      {
        name: "@monaco-editor/react",
        url: "https://www.npmjs.com/package/@monaco-editor/react",
      },
      {
        name: "fast-xml-parser",
        url: "https://www.npmjs.com/package/fast-xml-parser",
      },
      {
        name: "pretty-data",
        url: "https://www.npmjs.com/package/pretty-data",
      },
      {
        name: "react-inspector",
        url: "https://www.npmjs.com/package/react-inspector",
      },
    ],
  },
];
