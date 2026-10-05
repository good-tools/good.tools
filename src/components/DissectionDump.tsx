import { useMemo } from 'react'

interface HighlightedTextProps {
  text: string
  start: number
  size: number
  onOffsetClicked: (offset: number) => void
}

function HighlightedText({ text, start, size, onOffsetClicked }: HighlightedTextProps) {
  const before = text.substring(0, start)
  const hl = text.substring(start, start + size)
  const end = text.substring(start + size)

  const handleClickWithOffset = (_e: React.MouseEvent<HTMLSpanElement>, offset: number) => {
    const s = window.getSelection()
    if (s) {
      onOffsetClicked(s.anchorOffset + offset)
    }
  }

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut for byte selection; the dissection tree is the keyboard path */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut for byte selection; the dissection tree is the keyboard path */}
      <span onClick={(e) => handleClickWithOffset(e, 0)}>{before}</span>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut for byte selection; the dissection tree is the keyboard path */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut for byte selection; the dissection tree is the keyboard path */}
      <span
        onClick={(e) => handleClickWithOffset(e, before.length)}
        className='rounded-xs bg-primary text-primary-foreground'
      >
        {hl}
      </span>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut for byte selection; the dissection tree is the keyboard path */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut for byte selection; the dissection tree is the keyboard path */}
      <span onClick={(e) => handleClickWithOffset(e, before.length + hl.length)}>{end}</span>
    </>
  )
}

interface DissectionDumpProps {
  buffer: Uint8Array
  selected: [number, number]
  select: (offset: number) => void
}

function DissectionDump({ buffer, selected, select }: DissectionDumpProps) {
  const [start, size] = selected
  // hex: 3 chars per byte; ascii: 16 chars + newline per line
  const asciiStart = start + Math.floor(start / 16)
  const asciiSize = size > 0 ? start + size + Math.floor((start + size) / 16) - asciiStart : 0

  const { addrLines, hexLines, asciiLines } = useMemo(() => {
    const addrLines: string[] = []
    const hexLines: string[] = []
    const asciiLines: string[] = []
    for (let i = 0; i < buffer.length; i += 16) {
      const block = [...buffer.subarray(i, i + 16)]
      const hex = block.map((v) => v.toString(16).padStart(2, '0'))
      addrLines.push(i.toString(16).padStart(8, '0'))
      // the full-width space keeps every byte 3 chars wide, so offsets stay computable
      hexLines.push(hex.length > 8 ? `${hex.slice(0, 8).join(' ')}\u3000${hex.slice(8).join(' ')}` : hex.join(' '))
      asciiLines.push(block.map((v) => (v >= 0x20 && v < 0x7f ? String.fromCharCode(v) : '.')).join(''))
    }
    return { addrLines, hexLines, asciiLines }
  }, [buffer])

  const onHexClick = (offset: number) => {
    select(Math.floor(offset / 3))
  }

  const onAsciiClick = (offset: number) => {
    select(offset - Math.floor(offset / 17))
  }

  return (
    <div className='flex font-mono text-xs whitespace-pre break-all'>
      <div className='select-none text-muted-foreground'>{addrLines.join('\n')}</div>
      <div className='ml-4 cursor-pointer'>
        <HighlightedText
          onOffsetClicked={onHexClick}
          text={hexLines.join('\n')}
          start={start * 3}
          size={size > 0 ? size * 3 - 1 : 0}
        />
      </div>
      <div className='ml-4 cursor-pointer'>
        <HighlightedText
          onOffsetClicked={onAsciiClick}
          text={asciiLines.join('\n')}
          start={asciiStart}
          size={asciiSize}
        />
      </div>
    </div>
  )
}

export default DissectionDump
