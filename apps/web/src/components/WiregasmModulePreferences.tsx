import { PrefType } from '@goodtools/wiregasm'
import { FolderOpen } from 'lucide-react'
import { useId, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface EnumOption {
  name: string
  description: string
  selected: boolean
}

interface Preference {
  name: string
  title: string
  description: string
  type: PrefType
  bool_value?: boolean
  enum_value?: EnumOption[]
  string_value?: string
  uint_value?: number
  range_value?: string
}

type Update = (name: string, value: string) => Promise<void>

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

function Field({
  pref,
  id,
  error,
  children,
}: {
  pref: Preference
  id: string
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1'>
      <Label htmlFor={id} title={pref.description} className='text-foreground/90'>
        {pref.title}
      </Label>
      {children}
      {error && <p className='text-xs text-destructive'>{error}</p>}
    </div>
  )
}

/** String / number / range prefs: edited as text, committed on blur or Enter. */
function TextPreference({ pref, initial, update }: { pref: Preference; initial: string; update: Update }) {
  const id = useId()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const commit = () => {
    setError(null)
    update(pref.name, value).catch((e: unknown) => setError(errorMessage(e)))
  }
  return (
    <Field pref={pref} id={id} error={error}>
      <Input
        id={id}
        type={pref.type === PrefType.PREF_PASSWORD ? 'password' : 'text'}
        inputMode={pref.type === PrefType.PREF_UINT ? 'numeric' : undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onEnter={commit}
        aria-invalid={error != null}
        className='h-8 font-mono'
      />
    </Field>
  )
}

function EnumPreference({ pref, update }: { pref: Preference; update: Update }) {
  const id = useId()
  const [value, setValue] = useState(pref.enum_value?.find((o) => o.selected)?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const onChange = (next: string) => {
    setError(null)
    update(pref.name, next).then(
      () => setValue(next),
      (e: unknown) => setError(errorMessage(e)),
    )
  }
  return (
    <Field pref={pref} id={id} error={error}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(fieldClass, 'h-8')}>
        {pref.enum_value?.map((o) => (
          <option key={o.name} value={o.name}>
            {o.description}
          </option>
        ))}
      </select>
    </Field>
  )
}

function FilePreference({
  pref,
  uploadFile,
  update,
}: {
  pref: Preference
  uploadFile: (f: File) => Promise<string>
  update: Update
}) {
  const id = useId()
  const [value, setValue] = useState(pref.string_value ?? '')
  const [error, setError] = useState<string | null>(null)
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    uploadFile(f)
      .then(async (path) => {
        await update(pref.name, path)
        setValue(path)
      })
      .catch((err: unknown) => setError(errorMessage(err)))
  }
  return (
    <Field pref={pref} id={id} error={error}>
      <div className='flex gap-2'>
        <Input id={id} value={value} readOnly className='h-8 font-mono' />
        <FileButton size='sm' variant='outline' onFileSelected={onFile}>
          <FolderOpen /> Browse
        </FileButton>
      </div>
    </Field>
  )
}

function BooleanPreference({ pref, update }: { pref: Preference; update: Update }) {
  const [checked, setChecked] = useState(pref.bool_value ?? false)
  const [error, setError] = useState<string | null>(null)
  const toggle = () => {
    setError(null)
    update(pref.name, String(!checked)).then(
      () => setChecked(!checked),
      (e: unknown) => setError(errorMessage(e)),
    )
  }
  return (
    <div>
      <Checkbox title={pref.title} description={pref.description} checked={checked} onChange={toggle} />
      {error && <p className='text-xs text-destructive'>{error}</p>}
    </div>
  )
}

function PreferenceItem({
  pref,
  uploadFile,
  update,
}: {
  pref: Preference
  uploadFile: (f: File) => Promise<string>
  update: Update
}) {
  switch (pref.type) {
    case PrefType.PREF_BOOL:
      return <BooleanPreference pref={pref} update={update} />
    case PrefType.PREF_ENUM:
      return <EnumPreference pref={pref} update={update} />
    case PrefType.PREF_OPEN_FILENAME:
      return <FilePreference pref={pref} uploadFile={uploadFile} update={update} />
    case PrefType.PREF_UINT:
      return <TextPreference pref={pref} initial={String(pref.uint_value ?? 0)} update={update} />
    case PrefType.PREF_RANGE:
    case PrefType.PREF_DECODE_AS_RANGE:
      return <TextPreference pref={pref} initial={pref.range_value ?? ''} update={update} />
    case PrefType.PREF_STRING:
    case PrefType.PREF_DIRNAME:
    case PrefType.PREF_PASSWORD:
      return <TextPreference pref={pref} initial={pref.string_value ?? ''} update={update} />
    default:
      return null
  }
}

interface WiregasmModulePreferencesProps {
  preferences: Preference[] | null
  uploadFile: (file: File) => Promise<string>
  updatePreferenceValue: Update
}

function WiregasmModulePreferences({ preferences, uploadFile, updatePreferenceValue }: WiregasmModulePreferencesProps) {
  if (!preferences) return <Spinner label='Loading preferences…' />
  if (preferences.length === 0) return <p className='text-sm text-muted-foreground'>This module has no preferences.</p>

  return (
    <ul className='max-w-xl space-y-3'>
      {preferences.map((pref) => (
        <li key={pref.name}>
          <PreferenceItem pref={pref} uploadFile={uploadFile} update={updatePreferenceValue} />
        </li>
      ))}
    </ul>
  )
}

export default WiregasmModulePreferences
export type { Preference }
