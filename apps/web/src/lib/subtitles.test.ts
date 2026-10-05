import { describe, expect, it } from 'vitest'
import { timestamp, toSrt, toText, toVtt } from './subtitles'

const cues = [
  { start: 0, end: 2.5, text: ' Hello there.' },
  { start: 2.5, end: 3, text: '   ' },
  { start: 3725.5004, end: 3727.0996, text: 'Over an hour in.' },
]

describe('subtitles', () => {
  it('formats timestamps', () => {
    expect(timestamp(0)).toBe('00:00:00.000')
    expect(timestamp(59.9996)).toBe('00:01:00.000')
    expect(timestamp(3725.5, ',')).toBe('01:02:05,500')
    expect(timestamp(-1)).toBe('00:00:00.000')
  })

  it('writes SRT with 1-based indices, skipping empty cues', () => {
    expect(toSrt(cues)).toBe(
      '1\n00:00:00,000 --> 00:00:02,500\nHello there.\n\n2\n01:02:05,500 --> 01:02:07,100\nOver an hour in.\n',
    )
  })

  it('writes WebVTT', () => {
    expect(toVtt(cues)).toBe(
      'WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHello there.\n\n01:02:05.500 --> 01:02:07.100\nOver an hour in.\n',
    )
  })

  it('writes plain text', () => {
    expect(toText(cues)).toBe('Hello there.\nOver an hour in.')
  })
})
