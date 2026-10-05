/** A timed piece of a transcript, in seconds. */
export interface Cue {
  start: number
  end: number
  text: string
}

/** 3725.5 → "01:02:05,500" (SRT) or "01:02:05.500" (WebVTT) */
export function timestamp(seconds: number, separator: ',' | '.' = '.'): string {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor(ms / 60_000) % 60
  const s = Math.floor(ms / 1000) % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms % 1000, 3)}`
}

const lines = (cues: Cue[]) => cues.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text)

export const toText = (cues: Cue[]) =>
  lines(cues)
    .map((c) => c.text)
    .join('\n')

export const toSrt = (cues: Cue[]) =>
  lines(cues)
    .map((c, i) => `${i + 1}\n${timestamp(c.start, ',')} --> ${timestamp(c.end, ',')}\n${c.text}\n`)
    .join('\n')

export const toVtt = (cues: Cue[]) =>
  `WEBVTT\n\n${lines(cues)
    .map((c) => `${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}\n`)
    .join('\n')}`
