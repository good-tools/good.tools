import { buildArgs, parseTime } from '@/lib/media'

test('parseTime', () => {
  expect(parseTime('')).toBeUndefined()
  expect(parseTime(' 90 ')).toBe(90)
  expect(parseTime('1:30')).toBe(90)
  expect(parseTime('01:02:03.5')).toBe(3723.5)
  expect(parseTime('abc')).toBeNaN()
  expect(parseTime('1:2:3:4')).toBeNaN()
})

test('mp4 re-encode with trim and scale', () => {
  expect(buildArgs('in.mov', 'out.mp4', { format: 'mp4', quality: 'small', height: 720, start: 5, end: 15 })).toEqual([
    '-ss',
    '5',
    '-t',
    '10',
    '-threads',
    '4',
    '-i',
    'in.mov',
    '-threads',
    '4',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '32',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-vf',
    'scale=-2:min(720\\,ih)',
    '-movflags',
    '+faststart',
    'out.mp4',
  ])
})

test('copy remuxes; end without start trims from 0', () => {
  expect(buildArgs('in.mov', 'out.mp4', { format: 'mp4', quality: 'copy', height: 480, end: 3 })).toEqual([
    '-t',
    '3',
    '-threads',
    '4',
    '-i',
    'in.mov',
    '-threads',
    '4',
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    'out.mp4',
  ])
})

test('audio extraction drops video', () => {
  expect(buildArgs('a.mp4', 'b.mp3', { format: 'mp3', quality: 'high', height: 0 })).toEqual([
    '-threads',
    '4',
    '-i',
    'a.mp4',
    '-threads',
    '4',
    '-vn',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    'b.mp3',
  ])
  // WAV can't copy; it always writes PCM
  expect(buildArgs('a.mp4', 'b.wav', { format: 'wav', quality: 'copy', height: 0 })).toContain('pcm_s16le')
})

test('gif uses a palette', () => {
  const args = buildArgs('a.mp4', 'b.gif', { format: 'gif', quality: 'medium', height: 320 })
  expect(args[args.indexOf('-filter_complex') + 1]).toBe(
    'fps=10,scale=-2:min(320\\,ih):flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse',
  )
})
