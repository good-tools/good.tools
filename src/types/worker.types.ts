/**
 * Wiregasm worker message types
 */
export type WiregasmMessageType =
  | 'columns'
  | 'select'
  | 'select-frames'
  | 'check-filter'
  | 'process'
  | 'process-data'
  | 'reload-quick'
  | 'module-tree'
  | 'module-prefs'
  | 'upload-file'
  | 'update-pref'
  | 'apply-prefs'
  | 'get-version'

/**
 * Wiregasm worker message
 */
export interface WiregasmMessage {
  type: WiregasmMessageType
  data?: unknown
  port?: MessagePort
}

/**
 * Wiregasm worker response
 */
export interface WiregasmResponse {
  type: WiregasmMessageType
  data?: unknown
  error?: string
}

/**
 * Packet column definition
 */
export interface PacketColumn {
  id: string
  name: string
  type: string
}

/**
 * Packet frame data
 */
export interface PacketFrame {
  number: number
  time: string
  source: string
  destination: string
  protocol: string
  length: number
  info: string
}

/**
 * Packet dissection tree node
 */
export interface DissectionNode {
  label: string
  value?: string
  children?: DissectionNode[]
  start?: number
  length?: number
}

/**
 * Wireshark module preference
 */
export interface WiresharkPreference {
  name: string
  title: string
  description: string
  type: string
  value: unknown
  default: unknown
}

/**
 * Wireshark module
 */
export interface WiresharkModule {
  name: string
  title: string
  description: string
  preferences: WiresharkPreference[]
  children?: WiresharkModule[]
}
