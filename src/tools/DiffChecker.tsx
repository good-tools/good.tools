import { DiffEditor, default as Editor } from '@monaco-editor/react'
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fieldClass } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { cn } from '@/lib/utils'
import { useIsDark } from '@/stores/theme.store'

const LANGUAGES = [
  'plaintext',
  'json',
  'xml',
  'yaml',
  'html',
  'css',
  'markdown',
  'javascript',
  'typescript',
  'python',
  'go',
  'java',
  'sql',
  'shell',
  'ini',
  'dockerfile',
]

type View = 'original' | 'modified' | 'diff'

function DiffChecker() {
  const dark = useIsDark()
  const theme = dark ? 'vs-dark' : 'light'
  const [original, setOriginal] = useToolState('diff:original', '')
  const [changed, setChanged] = useToolState('diff:changed', '')
  const [language, setLanguage] = useToolState('diff:language', 'plaintext')
  const [view, setView] = useToolState<View>('diff:view', 'original')

  return (
    <Workspace
      toolbar={
        <>
          <Segmented<View>
            label='View'
            value={view}
            onChange={setView}
            options={[
              ['original', 'Original'],
              ['modified', 'Modified'],
              ['diff', 'Diff'],
            ]}
          />
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              setOriginal(changed)
              setChanged(original)
            }}
          >
            <ArrowLeftRight /> Swap sides
          </Button>
          <div className='ml-auto flex items-center gap-2'>
            <Label htmlFor='diff-language'>Language</Label>
            <select
              id='diff-language'
              className={cn(fieldClass, 'h-7 w-32 py-0 text-xs')}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </>
      }
    >
      <div className='min-h-0 flex-1 overflow-hidden rounded-md border'>
        {view === 'diff' ? (
          <DiffEditor
            height='100%'
            original={original}
            modified={changed}
            language={language}
            theme={theme}
            options={{ readOnly: true, originalEditable: false }}
          />
        ) : (
          <Editor
            key={view}
            height='100%'
            value={view === 'original' ? original : changed}
            language={language}
            theme={theme}
            onChange={(v) => (view === 'original' ? setOriginal : setChanged)(v ?? '')}
            options={{
              ariaLabel: view === 'original' ? 'Original text' : 'Modified text',
              minimap: { enabled: false },
            }}
          />
        )}
      </div>
    </Workspace>
  )
}

export default DiffChecker
