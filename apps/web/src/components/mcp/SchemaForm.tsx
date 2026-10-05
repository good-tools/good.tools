import { Checkbox } from '@/components/ui/checkbox'
import { fieldClass, Input, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface JsonSchema {
  type?: string | string[]
  description?: string
  title?: string
  enum?: unknown[]
  default?: unknown
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  minimum?: number
  maximum?: number
  format?: string
}

/** Raw field values as typed: strings for text/number/JSON fields, booleans for checkboxes. */
export type FormValues = Record<string, string | boolean>

type Kind = 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'json'

function kindOf(schema: JsonSchema): Kind {
  if (schema.enum) return 'enum'
  const types = (Array.isArray(schema.type) ? schema.type : [schema.type]).filter((t) => t && t !== 'null')
  const t = types.length === 1 ? types[0] : undefined
  if (t === 'string' || t === 'number' || t === 'integer' || t === 'boolean') return t
  return 'json'
}

/** Initial form values from schema defaults. */
export function initialValues(schema: JsonSchema | undefined): FormValues {
  const values: FormValues = {}
  for (const [name, prop] of Object.entries(schema?.properties ?? {})) {
    const kind = kindOf(prop)
    if (kind === 'boolean') values[name] = prop.default === true
    else if (prop.default !== undefined)
      values[name] = kind === 'json' ? JSON.stringify(prop.default, null, 2) : String(prop.default)
    else values[name] = ''
  }
  return values
}

/** Converts form values to call arguments. Empty optional fields are omitted. Throws with a field-specific message. */
export function toArguments(schema: JsonSchema | undefined, values: FormValues): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  const required = new Set(schema?.required ?? [])
  for (const [name, prop] of Object.entries(schema?.properties ?? {})) {
    const kind = kindOf(prop)
    const raw = values[name]
    if (kind === 'boolean') {
      if (raw === true || required.has(name)) args[name] = raw === true
      continue
    }
    const text = typeof raw === 'string' ? raw : ''
    if (text.trim() === '') {
      if (required.has(name)) throw new Error(`"${name}" is required`)
      continue
    }
    if (kind === 'number' || kind === 'integer') {
      const n = Number(text)
      if (!Number.isFinite(n) || (kind === 'integer' && !Number.isInteger(n)))
        throw new Error(`"${name}" must be ${kind === 'integer' ? 'an integer' : 'a number'}`)
      args[name] = n
    } else if (kind === 'enum') {
      // enum values may be numbers; map back to the original typed value
      args[name] = prop.enum?.find((v) => String(v) === text) ?? text
    } else if (kind === 'json') {
      try {
        args[name] = JSON.parse(text)
      } catch {
        throw new Error(`"${name}" must be valid JSON`)
      }
    } else args[name] = text
  }
  return args
}

const typeLabel = (schema: JsonSchema) =>
  schema.enum
    ? 'enum'
    : Array.isArray(schema.type)
      ? schema.type.join(' | ')
      : (schema.type ?? (schema.anyOf || schema.oneOf ? 'union' : 'any'))

export function SchemaForm({
  schema,
  values,
  onChange,
  onSubmit,
  idPrefix,
}: {
  schema: JsonSchema | undefined
  values: FormValues
  onChange: (v: FormValues) => void
  onSubmit: () => void
  idPrefix: string
}) {
  const properties = Object.entries(schema?.properties ?? {})
  const required = new Set(schema?.required ?? [])
  if (properties.length === 0) return <p className='px-3 py-2.5 text-xs text-muted-foreground'>No arguments.</p>

  const set = (name: string, value: string | boolean) => onChange({ ...values, [name]: value })

  return (
    <div className='flex flex-col divide-y'>
      {properties.map(([name, prop]) => {
        const kind = kindOf(prop)
        const id = `${idPrefix}-${name}`
        const value = values[name]
        return (
          <div key={name} className='grid gap-x-4 gap-y-1 px-3 py-2.5 sm:grid-cols-[minmax(0,13rem)_1fr]'>
            <div className='min-w-0'>
              <label htmlFor={id} className='flex items-baseline gap-1.5 font-mono text-xs font-medium'>
                {name}
                {required.has(name) && (
                  <span className='text-destructive' title='Required'>
                    *
                  </span>
                )}
              </label>
              <span className='font-mono text-[11px] text-muted-foreground'>{typeLabel(prop)}</span>
            </div>
            <div className='flex min-w-0 flex-col gap-1'>
              {kind === 'boolean' ? (
                <Checkbox
                  id={id}
                  checked={value === true}
                  onChange={(e) => set(name, e.target.checked)}
                  title={prop.title}
                />
              ) : kind === 'enum' ? (
                <select
                  id={id}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => set(name, e.target.value)}
                  className={cn(fieldClass, 'h-8 py-0 pr-8 font-mono text-xs')}
                >
                  {!required.has(name) && <option value=''>—</option>}
                  {prop.enum?.map((v) => (
                    <option key={String(v)} value={String(v)}>
                      {String(v)}
                    </option>
                  ))}
                </select>
              ) : kind === 'json' ? (
                <Textarea
                  id={id}
                  rows={3}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => set(name, e.target.value)}
                  onCtrlEnter={onSubmit}
                  placeholder={prop.type === 'array' ? '["a", "b"]' : '{ }'}
                />
              ) : (
                <Input
                  id={id}
                  type={kind === 'string' ? 'text' : 'number'}
                  step={kind === 'integer' ? 1 : 'any'}
                  min={prop.minimum}
                  max={prop.maximum}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => set(name, e.target.value)}
                  onEnter={onSubmit}
                  className='font-mono text-xs'
                  placeholder={prop.default !== undefined ? `Default: ${String(prop.default)}` : undefined}
                />
              )}
              {prop.description && <p className='text-[11px] leading-snug text-muted-foreground'>{prop.description}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
