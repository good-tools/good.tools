import { useEffect, useRef } from 'react'
import TextArea from '@/components/TextArea'
import { Button } from '@/components/ui/button'
import { useJsonEscapeStore } from '@/stores'

/**
 * Escapes special JSON characters in a string
 */
function escapeJson(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Unescapes JSON escaped characters in a string
 */
function unescapeJson(str: string): string {
  try {
    // Use JSON.parse with a wrapper to handle the unescaping
    return JSON.parse(`"${str}"`) as string
  } catch {
    // If JSON.parse fails, try manual replacement
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

function JsonEscape() {
  const { input, setInput, reset } = useJsonEscapeStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleEscape = () => {
    const escaped = escapeJson(input)
    setInput(escaped)
  }

  const handleUnescape = () => {
    const unescaped = unescapeJson(input)
    setInput(unescaped)
  }

  const handleClear = () => {
    reset()
  }

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <div>
      <TextArea
        ref={textareaRef}
        id='json-input'
        name='json-input'
        rows={12}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onCtrlEnter={() => handleEscape()}
        placeholder='Paste your text here'
      />
      <div className='mt-3'>
        <Button onClick={handleEscape}>Escape</Button>
        <Button className='ml-2' variant='secondary' onClick={handleUnescape}>
          Unescape
        </Button>
        <Button variant='ghost' className='ml-3' onClick={handleClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}

export default JsonEscape
