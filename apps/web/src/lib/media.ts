/** ffmpeg command lines for the Video & Audio Converter. */

export type MediaFormat = 'mp4' | 'webm' | 'gif' | 'mp3' | 'm4a' | 'wav'
/** `copy` keeps the streams as they are (remux only): fast, no quality loss, same size */
export type MediaQuality = 'copy' | 'high' | 'medium' | 'small'

export interface MediaOptions {
  format: MediaFormat
  quality: MediaQuality
  /** Maximum output height in pixels; 0 keeps the original */
  height: number
  /** Trim range in seconds; undefined = from the start / to the end */
  start?: number
  end?: number
}

export const AUDIO_ONLY: MediaFormat[] = ['mp3', 'm4a', 'wav']

export const MIME: Record<MediaFormat, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
}

/** Whether `copy` can work for this format (GIF and WAV always re-encode). */
export const canCopy = (format: MediaFormat) => format !== 'gif' && format !== 'wav'

/** Parses `90`, `1:30`, `01:02:03.5` into seconds; empty → undefined; anything else → NaN. */
export function parseTime(text: string): number | undefined {
  const t = text.trim()
  if (!t) return undefined
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return Number.NaN
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0)
}

const level = { high: 0, medium: 1, small: 2, copy: 1 } as const
const pick = <T>(q: MediaQuality, values: [T, T, T]) => values[level[q]]

/** Arguments for `ffmpeg.exec`, reading `input` and writing `output`. */
export function buildArgs(input: string, output: string, o: MediaOptions): string[] {
  const args: string[] = []
  if (o.start) args.push('-ss', String(o.start))
  if (o.end !== undefined) args.push('-t', String(o.end - (o.start ?? 0)))
  // ponytail: fixed 4 threads. ffmpeg.wasm's multi-threaded core has a fixed pool of 32 workers and deadlocks when
  // the decoder and x264 auto-size their threads to the CPU count; make it adaptive if the core gets a bigger pool
  args.push('-threads', '4', '-i', input, '-threads', '4')

  const copy = o.quality === 'copy' && canCopy(o.format)
  const scale = o.height ? `scale=-2:min(${o.height}\\,ih)` : ''
  const bitrate = pick(o.quality, ['192k', '128k', '96k'])

  switch (o.format) {
    case 'mp4':
      if (copy) args.push('-c', 'copy')
      else {
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(pick(o.quality, [20, 26, 32])))
        args.push('-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', bitrate)
        if (scale) args.push('-vf', scale)
      }
      args.push('-movflags', '+faststart')
      break
    case 'webm':
      if (copy) args.push('-c', 'copy')
      else {
        // VP8: the core's VP9 encoder crashes (memory access out of bounds). Constrained quality: crf capped by -b:v
        args.push(
          '-c:v',
          'libvpx',
          '-crf',
          String(pick(o.quality, [10, 20, 32])),
          '-b:v',
          pick(o.quality, ['4M', '2M', '1M']),
        )
        args.push('-deadline', 'realtime', '-cpu-used', '8', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-b:a', bitrate)
        if (scale) args.push('-vf', scale)
      }
      break
    case 'gif': {
      const fps = pick(o.quality, [15, 10, 8])
      const colors = pick(o.quality, [256, 128, 64])
      args.push(
        '-filter_complex',
        `fps=${fps}${scale ? `,${scale}:flags=lanczos` : ''},split[a][b];[a]palettegen=max_colors=${colors}[p];[b][p]paletteuse`,
        '-loop',
        '0',
      )
      break
    }
    case 'mp3':
      args.push('-vn', ...(copy ? ['-c:a', 'copy'] : ['-c:a', 'libmp3lame', '-b:a', bitrate]))
      break
    case 'm4a':
      args.push('-vn', ...(copy ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', bitrate]))
      break
    case 'wav':
      args.push('-vn', '-c:a', 'pcm_s16le')
      break
  }
  args.push(output)
  return args
}
