import { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { ObjectInspector } from 'react-inspector'
import { Eraser, Minimize2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert } from '@/components/ui/alert'
import { CopyButton } from '@/components/ui/copy-button'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useIsDark } from '@/stores/theme.store'
import { applyJsonPath, useJSONFormatterStore } from '@/stores/json-formatter.store'

const editorOptions = { wordWrap: 'on' as const, contextmenu: false, minimap: { enabled: false } }

function JsonFormatter() {
  const dark = useIsDark()
  const { value, setValue, parsed, error, query, setQuery, tree, setTree } = useJSONFormatterStore()
  // Monaco's JSON validator gives a line/column even when JSON.parse's message doesn't
  const [where, setWhere] = useState<string | null>(null)
  const { result, error: queryError } = useMemo(() => applyJsonPath(parsed, query), [parsed, query])
  const output = result === undefined ? '' : JSON.stringify(result, null, 2)

  const format = () => {
    if (parsed !== undefined) setValue(JSON.stringify(parsed, null, 2))
  }
  const minify = () => {
    if (parsed !== undefined) setValue(JSON.stringify(parsed))
  }

  // Capture phase so Monaco doesn't also handle Ctrl+Enter (insert line)
  const ctrlEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      format()
    }
  }

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={format} disabled={parsed === undefined} title='Format (Ctrl+Enter)'>
            <WandSparkles /> Format
          </Button>
          <Button size='sm' variant='outline' onClick={minify} disabled={parsed === undefined}>
            <Minimize2 /> Minify
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setValue('')}>
            <Eraser /> Clear
          </Button>
        </>
      }
    >
      <Alert>{error && `Invalid JSON: ${error}${where && !/line \d+/.test(error) ? ` (${where})` : ''}`}</Alert>
      <div className='min-h-0 flex-1'>
        <Allotment>
          <Allotment.Pane minSize={240}>
            <Panel title='Input' className='mr-1 h-full'>
              <div className='h-full' onKeyDownCapture={ctrlEnter}>
                <Editor
                  height='100%'
                  value={value}
                  theme={dark ? 'vs-dark' : 'light'}
                  defaultLanguage='json'
                  onChange={(v) => setValue(v ?? '')}
                  onValidate={(markers) =>
                    setWhere(markers[0] ? `line ${markers[0].startLineNumber}, column ${markers[0].startColumn}` : null)
                  }
                  options={{ ...editorOptions, ariaLabel: 'JSON input' }}
                />
              </div>
            </Panel>
          </Allotment.Pane>
          <Allotment.Pane minSize={240}>
            <Panel
              title='Output'
              className='ml-1 h-full'
              actions={<CopyButton value={output} disabled={!output} size='icon-sm' />}
            >
              <div className='flex h-full flex-col'>
                <div className='flex shrink-0 items-center gap-2 border-b px-2 py-1'>
                  <Input
                    aria-label='JSONPath query'
                    className='h-7 font-mono'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='$.message'
                  />
                  <Checkbox checked={tree} onChange={() => setTree(!tree)} title='Tree' className='shrink-0' />
                </div>
                {queryError && <Alert className='m-1.5 shrink-0'>{`Invalid JSONPath: ${queryError}`}</Alert>}
                <div className='min-h-0 flex-1 overflow-auto'>
                  {tree ? (
                    <div className='p-2'>
                      {result !== undefined && (
                        <ObjectInspector data={result} expandLevel={1} theme={dark ? 'chromeDark' : 'chromeLight'} />
                      )}
                    </div>
                  ) : (
                    <Editor
                      height='100%'
                      value={output}
                      theme={dark ? 'vs-dark' : 'light'}
                      language='json'
                      options={{ ...editorOptions, readOnly: true, ariaLabel: 'JSON output' }}
                    />
                  )}
                </div>
              </div>
            </Panel>
          </Allotment.Pane>
        </Allotment>
      </div>
    </Workspace>
  )
}

export default JsonFormatter
