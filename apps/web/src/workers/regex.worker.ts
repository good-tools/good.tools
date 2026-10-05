/** Runs regex matching off the main thread so a catastrophic pattern can be killed by terminating the worker. */
import { runRegex } from '@/lib/regex'

export interface RegexRequest {
  pattern: string
  flags: string
  text: string
  replacement?: string
}

self.onmessage = ({ data: { pattern, flags, text, replacement } }: MessageEvent<RegexRequest>) => {
  self.postMessage(runRegex(pattern, flags, text, replacement))
}
