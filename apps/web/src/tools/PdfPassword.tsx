import { filesize } from 'filesize'
import { Download, FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { renamePdf } from '@/lib/pdf'
import { protectPdf, unlockPdf } from '@/lib/qpdf'
import { downloadBlob } from '@/lib/utils'

type Mode = 'protect' | 'unlock'

interface Source {
  name: string
  bytes: Uint8Array
}

function PdfPassword() {
  const [mode, setMode] = useToolState<Mode>('pdf-password:mode', 'protect')
  const [source, setSource] = useToolState<Source | null>('pdf-password:source', null)
  // Passwords are deliberately not kept when navigating away
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [owner, setOwner] = useState('')
  const [allow, setAllow] = useToolState('pdf-password:allow', { printing: true, copying: true, modifying: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const mismatch = mode === 'protect' && confirm !== '' && confirm !== password
  const ready = source && !busy && (mode === 'unlock' || (password && password === confirm))

  const run = async () => {
    if (!source || !ready) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      const out =
        mode === 'protect'
          ? await protectPdf(source.bytes, { userPassword: password, ownerPassword: owner, ...allow })
          : await unlockPdf(source.bytes, password)
      const name = renamePdf(source.name, mode === 'protect' ? 'protected' : 'unlocked')
      downloadBlob(out, name, 'application/pdf')
      setDone(`Saved ${name}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(mode === 'protect' && /password-protected/.test(message) ? `${message}; unlock it first` : message)
    }
    setBusy(false)
  }

  const load = async ([file]: File[]) => {
    if (!file) return
    setSource({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
    setError('')
    setDone('')
  }

  return (
    <DropTarget onFiles={(f) => void load(f)} label='Drop to replace the PDF'>
      <Workspace
        toolbar={
          <>
            <Segmented<Mode>
              label='Mode'
              value={mode}
              onChange={(m) => {
                setMode(m)
                setError('')
                setDone('')
              }}
              options={[
                ['protect', 'Protect'],
                ['unlock', 'Unlock'],
              ]}
            />
            {source && (
              <Button size='sm' variant='ghost' onClick={() => setSource(null)}>
                <Trash2 /> Clear
              </Button>
            )}
          </>
        }
      >
        {source ? (
          <div className='flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px]'>
            <FileText className='size-4 shrink-0 text-muted-foreground' />
            <span className='min-w-0 truncate'>{source.name}</span>
            <span className='text-xs text-muted-foreground'>{filesize(source.bytes.byteLength, { base: 2 })}</span>
          </div>
        ) : (
          <DropZone
            className='py-5'
            accept='application/pdf,.pdf'
            onFiles={(f) => void load(f)}
            hint='Stays in your browser'
          >
            Drop a PDF here or click to browse
          </DropZone>
        )}

        <form
          className='flex max-w-sm flex-col gap-2.5'
          onSubmit={(e) => {
            e.preventDefault()
            void run()
          }}
        >
          <Label className='flex flex-col gap-1'>
            {mode === 'protect' ? 'Password to open the PDF' : 'Password'}
            <Input
              type='password'
              autoComplete='new-password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'unlock' ? 'Leave empty if it only has restrictions' : undefined}
            />
          </Label>
          {mode === 'protect' && (
            <>
              <Label className='flex flex-col gap-1'>
                Confirm password
                <Input
                  type='password'
                  autoComplete='new-password'
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={mismatch}
                />
              </Label>
              {mismatch && <span className='text-xs text-destructive'>Passwords don't match</span>}
              <fieldset className='flex flex-col gap-1.5'>
                <legend className='mb-1 text-xs text-muted-foreground'>People who open it may</legend>
                {(
                  [
                    ['printing', 'Print'],
                    ['copying', 'Copy text and images'],
                    ['modifying', 'Edit, comment, fill forms'],
                  ] as const
                ).map(([key, title]) => (
                  <Checkbox
                    key={key}
                    title={title}
                    checked={allow[key]}
                    onChange={(e) => setAllow({ ...allow, [key]: e.target.checked })}
                  />
                ))}
              </fieldset>
              {!(allow.printing && allow.copying && allow.modifying) && (
                <Label className='flex flex-col gap-1'>
                  Owner password (lifts the restrictions)
                  <Input
                    type='password'
                    autoComplete='new-password'
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder='Optional; without it nobody can lift them'
                  />
                </Label>
              )}
            </>
          )}
          <div className='flex items-center gap-2'>
            <Button type='submit' size='sm' className='self-start' disabled={!ready}>
              <Download /> {mode === 'protect' ? 'Protect' : 'Unlock'} &amp; download
            </Button>
            {busy && <Spinner />}
          </div>
          <Alert>{error}</Alert>
          <Alert variant='info'>{done}</Alert>
        </form>
      </Workspace>
    </DropTarget>
  )
}

export default PdfPassword
