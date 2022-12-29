import {
  AcademicCapIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  ReceiptRefundIcon,
} from '@heroicons/react/24/outline'
import React from 'react'

export const serviceBaseUrl = "https://api.good.tools"
export const internetToolsBaseUrl = "https://internet-tools.fly.dev"

export const tools = [
  {
    title: 'Base64 Encoder and Decoder',
    href: '/base64',
    icon: CheckBadgeIcon,
    iconForeground: 'text-purple-700',
    iconBackground: 'bg-purple-50',
    tags: ['base64', 'base', '64', 'encoder', 'decoder'],
    component: React.lazy(() => import('./tools/Base64')),
  },
  {
    title: 'Example Tool',
    href: '/example-tool',
    icon: BanknotesIcon,
    iconForeground: 'text-yellow-700',
    iconBackground: 'bg-yellow-50',
    tags: ['example', 'tool'],
    component: React.lazy(() => import('./tools/ExampleTool')),
  },
  {
    title: 'Diff Checker',
    href: '/diff-checker',
    icon: BanknotesIcon,
    iconForeground: 'text-yellow-700',
    iconBackground: 'bg-yellow-50',
    tags: ['diff', 'text', 'checker'],
    component: React.lazy(() => import('./tools/DiffChecker')),
  },
  {
    title: 'Certificate Decoder',
    href: '/certificate-decoder',
    icon: BanknotesIcon,
    iconForeground: 'text-yellow-700',
    iconBackground: 'bg-yellow-50',
    tags: ['certificate', 'ssl', 'decoder'],
    component: React.lazy(() => import('./tools/CertificateDecoder')),
  },
  {
    title: 'Docker Browser',
    href: '/docker-browser',
    icon: BanknotesIcon,
    iconForeground: 'text-yellow-700',
    iconBackground: 'bg-yellow-50',
    tags: ['docker', 'image', 'browser', 'oci', 'container'],
    component: React.lazy(() => import('./tools/ImageBrowser')),
  },
  {
    title: 'WHOIS',
    href: '/whois',
    icon: BanknotesIcon,
    iconForeground: 'text-yellow-700',
    iconBackground: 'bg-yellow-50',
    tags: ['whois', 'lookup'],
    component: React.lazy(() => import('./tools/Whois')),
  },
  {
    title: 'DNS Lookup',
    href: '/dns',
    icon: BanknotesIcon,
    iconForeground: 'text-yellow-700',
    iconBackground: 'bg-yellow-50',
    tags: ['dns', 'lookup'],
    component: React.lazy(() => import('./tools/DNS')),
  },
  {
    title: 'Whats My IP',
    href: '/whats-my-ip',
    icon: AcademicCapIcon,
    iconForeground: 'text-rose-700',
    iconBackground: 'bg-rose-50',
    tags: ['whats', 'my', 'ip', 'address'],
    component: React.lazy(() => import('./tools/WhatsMyIP')),
  },
  {
    title: 'IP to Location',
    href: '/ip-location',
    icon: ReceiptRefundIcon,
    iconForeground: 'text-rose-700',
    iconBackground: 'bg-rose-50',
    tags: ['ip', 'address', 'location'],
    component: React.lazy(() => import('./tools/IP2Location')),
  },
]
