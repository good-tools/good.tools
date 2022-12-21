import {
  AcademicCapIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  ReceiptRefundIcon,
} from '@heroicons/react/24/outline'
import React from 'react'

export const serviceBaseUrl = "https://api.good.tools"

export const tools = [
  {
    title: 'Base64 Encoder and Decoder',
    href: '/base64',
    icon: CheckBadgeIcon,
    iconForeground: 'text-purple-700',
    iconBackground: 'bg-purple-50',
    tags: ['base64', 'base', '64', 'encode', 'encoder', 'decode', 'decoder'],
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
    tags: ['diff', 'text', 'check', 'checker'],
    component: React.lazy(() => import('./tools/DiffChecker')),
  },
  {
    title: 'Whats My IP',
    href: '/whats-my-ip',
    icon: AcademicCapIcon,
    iconForeground: 'text-rose-700',
    iconBackground: 'bg-rose-50',
    tags: ['what', 'whats', 'my', 'ip', 'address'],
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
