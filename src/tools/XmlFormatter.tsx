import Editor from '@monaco-editor/react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { ObjectInspector } from 'react-inspector'
import { Braces, Eraser, ListTree, Minimize2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { CopyButton } from '@/components/ui/copy-button'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { useIsDark } from '@/stores/theme.store'
import { useXMLFormatterStore } from '@/stores/xml-formatter.store'

const editorOptions = { wordWrap: 'on' as const, contextmenu: false, minimap: { enabled: false } }

function XmlFormatter() {
  const dark = useIsDark()
  const { value, setValue, error, output, run } = useXMLFormatterStore()
  const text = output && output.kind !== 'tree' ? output.text : ''

  // Capture phase so Monaco doesn't also handle Ctrl+Enter (insert line)
  const ctrlEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      run('format')
    }
  }

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={() => run('format')} title='Format (Ctrl+Enter)'>
            <WandSparkles /> Format
          </Button>
          <Button size='sm' variant='outline' onClick={() => run('minify')}>
            <Minimize2 /> Minify
          </Button>
          <Button size='sm' variant='outline' onClick={() => run('json')}>
            <Braces /> To JSON
          </Button>
          <Button size='sm' variant='outline' onClick={() => run('tree')}>
            <ListTree /> Object tree
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setValue('')}>
            <Eraser /> Clear
          </Button>
        </>
      }
    >
      <Alert>{error && `Invalid XML: ${error}`}</Alert>
      <div className='min-h-0 flex-1'>
        <Allotment>
          <Allotment.Pane minSize={240}>
            <Panel title='Input' className='mr-1 h-full'>
              <div className='h-full' onKeyDownCapture={ctrlEnter}>
                <Editor
                  height='100%'
                  value={value}
                  theme={dark ? 'vs-dark' : 'light'}
                  language='xml'
                  onChange={(v) => setValue(v ?? '')}
                  options={{ ...editorOptions, ariaLabel: 'XML input' }}
                />
              </div>
            </Panel>
          </Allotment.Pane>
          <Allotment.Pane minSize={240}>
            <Panel
              title='Output'
              className='ml-1 h-full'
              actions={<CopyButton value={text} disabled={!text} size='icon-sm' />}
            >
              <div className='h-full'>
                {output?.kind === 'tree' ? (
                  <div className='p-2'>
                    <ObjectInspector data={output.data} expandLevel={2} theme={dark ? 'chromeDark' : 'chromeLight'} />
                  </div>
                ) : output ? (
                  <Editor
                    height='100%'
                    value={output.text}
                    theme={dark ? 'vs-dark' : 'light'}
                    language={output.kind}
                    options={{ ...editorOptions, readOnly: true, ariaLabel: 'Output' }}
                  />
                ) : (
                  <p className='p-2.5 text-xs text-muted-foreground'>Run an action to see output.</p>
                )}
              </div>
            </Panel>
          </Allotment.Pane>
        </Allotment>
      </div>
    </Workspace>
  )
}

export default XmlFormatter
