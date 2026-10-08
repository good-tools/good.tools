import { filesize } from 'filesize'
import { Download, Eraser, FileUp, KeyRound } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { fieldClass, Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import {
  type ChainResult,
  checkChain,
  createCsr,
  createSelfSigned,
  derToPem,
  EMPTY_SUBJECT,
  exportPrivateKeyPem,
  generateKeys,
  importPrivateKey,
  KEY_TYPES,
  type KeyType,
  parseCertificates,
  pemBlocks,
  pemToPkcs12,
  pkcs12ToPem,
  type Subject,
} from '@/lib/cert-toolkit'
import { cn, downloadBlob, formatDateTime } from '@/lib/utils'
import { validityStatus } from '@/tools/CertificateDecoder'

type Mode = 'csr' | 'self' | 'chain' | 'convert'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** File contents as PEM text: PEM files as-is, DER files converted. */
async function readAsPem(file: File) {
  const bytes = await file.arrayBuffer()
  const text = new TextDecoder().decode(bytes)
  return text.includes('-----BEGIN') ? text.trim() : derToPem(bytes)
}

function PemPanel({
  title,
  value,
  filename,
  placeholder,
}: {
  title: string
  value: string
  filename: string
  placeholder: string
}) {
  return (
    <Panel
      title={title}
      actions={
        <>
          <CopyButton value={value} disabled={!value} />
          <Button
            size='sm'
            variant='ghost'
            disabled={!value}
            onClick={() => downloadBlob(value, filename, 'application/x-pem-file')}
          >
            <Download /> Download
          </Button>
        </>
      }
    >
      <Textarea readOnly aria-label={title} className={paneField} value={value} placeholder={placeholder} />
    </Panel>
  )
}

const SUBJECT_FIELDS: [keyof Subject, string, string][] = [
  ['CN', 'Common name (CN)', 'example.com'],
  ['O', 'Organization (O)', 'Example Inc.'],
  ['OU', 'Unit (OU)', ''],
  ['L', 'City (L)', ''],
  ['ST', 'State (ST)', ''],
  ['C', 'Country (C)', 'US'],
]

function Generate({ selfSigned }: { selfSigned: boolean }) {
  const [subject, setSubject] = useToolState<Subject>('cert-toolkit:subject', EMPTY_SUBJECT)
  const [sans, setSans] = useToolState('cert-toolkit:sans', '')
  const [keySource, setKeySource] = useToolState<'new' | 'own'>('cert-toolkit:key-source', 'new')
  const [keyType, setKeyType] = useToolState<KeyType>('cert-toolkit:key-type', 'ec-p256')
  const [ownKey, setOwnKey] = useToolState('cert-toolkit:own-key', '')
  const [days, setDays] = useToolState('cert-toolkit:days', '365')
  const [out, setOut] = useToolState<{ pem: string; key: string; self: boolean } | null>('cert-toolkit:out', null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const keys = keySource === 'own' ? await importPrivateKey(ownKey) : await generateKeys(keyType)
      const req = { subject, sans, keys }
      const pem = selfSigned ? await createSelfSigned({ ...req, days: Number(days) }) : await createCsr(req)
      setOut({ pem, key: keySource === 'own' ? '' : await exportPrivateKeyPem(keys.privateKey), self: selfSigned })
    } catch (e) {
      setError(errorMessage(e))
    }
    setBusy(false)
  }

  const result = out?.self === selfSigned ? out : null
  const what = selfSigned ? 'Certificate' : 'CSR'

  return (
    <>
      <Alert>{error}</Alert>
      <Split>
        <Panel title={selfSigned ? 'Self-signed certificate' : 'Certificate signing request'}>
          <form
            className='grid gap-2.5 p-2.5 sm:grid-cols-2'
            onSubmit={(e) => {
              e.preventDefault()
              void run()
            }}
          >
            {SUBJECT_FIELDS.map(([k, label, placeholder]) => (
              <Label key={k} className='flex flex-col gap-1'>
                {label}
                <Input
                  value={subject[k]}
                  maxLength={k === 'C' ? 2 : 64}
                  placeholder={placeholder}
                  onChange={(e) => setSubject((s) => ({ ...s, [k]: e.target.value }))}
                />
              </Label>
            ))}
            <Label className='flex flex-col gap-1 sm:col-span-2'>
              Subject alternative names (DNS names and IPs, comma or space separated)
              <Input
                value={sans}
                placeholder='example.com, www.example.com, 10.0.0.1'
                onChange={(e) => setSans(e.target.value)}
              />
            </Label>
            {selfSigned && (
              <Label className='flex flex-col gap-1'>
                Validity (days)
                <Input type='number' min={1} value={days} onChange={(e) => setDays(e.target.value)} />
              </Label>
            )}
            <div className='flex flex-col gap-1 sm:col-span-2'>
              <span className='text-xs font-medium text-muted-foreground'>Key</span>
              <div className='flex flex-wrap items-center gap-2'>
                <Segmented
                  label='Key'
                  value={keySource}
                  onChange={setKeySource}
                  options={[
                    ['new', 'Generate new'],
                    ['own', 'Use my key'],
                  ]}
                />
                {keySource === 'new' && (
                  <select
                    aria-label='Key type'
                    className={cn(fieldClass, 'h-7 w-36 py-0 text-xs')}
                    value={keyType}
                    onChange={(e) => setKeyType(e.target.value as KeyType)}
                  >
                    {KEY_TYPES.map(([v, name]) => (
                      <option key={v} value={v}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {keySource === 'own' && (
              <Label className='flex flex-col gap-1 sm:col-span-2'>
                Private key (PEM, RSA or ECDSA)
                <Textarea
                  rows={6}
                  value={ownKey}
                  placeholder={'-----BEGIN PRIVATE KEY-----\n...'}
                  onChange={(e) => setOwnKey(e.target.value)}
                />
              </Label>
            )}
            <div className='flex items-center gap-2 sm:col-span-2'>
              <Button type='submit' size='sm' disabled={busy}>
                <KeyRound /> {selfSigned ? 'Create certificate' : 'Create CSR'}
              </Button>
              {busy && <Spinner label={keySource === 'new' ? 'Generating key…' : 'Signing…'} />}
              <span className='ml-auto text-xs text-muted-foreground'>The key never leaves your browser</span>
            </div>
          </form>
        </Panel>
        <div className='grid min-h-0 gap-2 lg:grid-rows-2'>
          <PemPanel
            title={what}
            value={result?.pem ?? ''}
            filename={selfSigned ? 'certificate.crt' : 'request.csr'}
            placeholder={`The ${what} appears here`}
          />
          <PemPanel
            title='Private key'
            value={result?.key ?? ''}
            filename='private.key'
            placeholder={
              keySource === 'own' ? 'Signed with your key' : 'The new private key appears here; keep it safe'
            }
          />
        </div>
      </Split>
    </>
  )
}

function Check({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  return <Badge variant={ok === null ? 'outline' : ok ? 'success' : 'destructive'}>{children}</Badge>
}

function ChainReport({ result }: { result: ChainResult }) {
  return (
    <div className='flex flex-col gap-2 p-2.5 text-xs'>
      <Alert variant={result.ok && result.rooted ? 'info' : 'warning'}>
        {result.ok
          ? result.rooted
            ? 'Every link checks out and the chain ends at a self-signed root.'
            : 'Every link present checks out, but the chain stops before a root. Servers normally leave the root out; add it to check the last signature.'
          : 'The chain has problems; see the red checks below.'}
      </Alert>
      <ol className='flex flex-col gap-2'>
        {result.links.map((l, i) => {
          const status = validityStatus(l.cert.notBefore, l.cert.notAfter)
          return (
            <li key={i} className='rounded-md border'>
              <div className='flex items-center gap-2 border-b bg-muted/50 px-2.5 py-1'>
                <span className='font-medium'>
                  {i + 1}. {l.role}
                </span>
                <span className='min-w-0 truncate font-mono text-muted-foreground'>{l.cert.subject}</span>
              </div>
              <dl className='grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 px-2.5 py-1.5'>
                <dt className='text-muted-foreground'>Issuer</dt>
                <dd className='break-all font-mono'>{l.cert.issuer}</dd>
                <dt className='text-muted-foreground'>Valid</dt>
                <dd>
                  {formatDateTime(l.cert.notBefore)} → {formatDateTime(l.cert.notAfter)}
                </dd>
                <dt className='text-muted-foreground'>Checks</dt>
                <dd className='flex flex-wrap gap-1'>
                  <Check ok={l.inDate}>{status.label}</Check>
                  <Check ok={l.signature}>
                    {l.signature === null ? 'Issuer missing' : l.signature ? 'Signature OK' : 'Bad signature'}
                  </Check>
                  {l.nameMatch !== null && (
                    <Check ok={l.nameMatch}>{l.nameMatch ? 'Names chain' : 'Issuer name mismatch'}</Check>
                  )}
                  {l.issuerIsCa !== null && (
                    <Check ok={l.issuerIsCa}>{l.issuerIsCa ? 'Issuer is a CA' : 'Issuer is not a CA'}</Check>
                  )}
                </dd>
              </dl>
            </li>
          )
        })}
      </ol>
      {result.unused.length > 0 && (
        <Alert variant='warning'>Not part of this chain: {result.unused.map((c) => c.subject).join('; ')}</Alert>
      )}
    </div>
  )
}

function Chain() {
  const [input, setInput] = useToolState('cert-toolkit:chain', '')
  const [state, setState] = useState<{ input: string; result?: ChainResult; error?: string }>({ input: '' })

  useEffect(() => {
    if (!input.trim()) return
    let current = true
    const done = (s: { result?: ChainResult; error?: string }) => current && setState({ input, ...s })
    try {
      checkChain(parseCertificates(input)).then(
        (result) => done({ result }),
        (e) => done({ error: errorMessage(e) }),
      )
    } catch (e) {
      done({ error: errorMessage(e) })
    }
    return () => {
      current = false
    }
  }, [input])

  const addFiles = async (files: File[]) => {
    try {
      const pems = await Promise.all(files.map(readAsPem))
      setInput((s) => [s.trim(), ...pems].filter(Boolean).join('\n'))
    } catch (e) {
      setState({ input, error: errorMessage(e) })
    }
  }

  const shown: { result?: ChainResult; error?: string } = input.trim() && state.input === input ? state : {}

  return (
    <DropTarget
      onFiles={(f) => void addFiles(f)}
      label='Drop to add certificates'
      className='flex min-h-0 flex-1 flex-col gap-2'
    >
      <Alert>{shown.error}</Alert>
      <Split>
        <Panel
          title='Certificates (PEM, any order)'
          actions={
            <>
              <FileButton
                size='sm'
                variant='ghost'
                multiple
                accept='.pem,.crt,.cer,.der'
                onFileSelected={(e) => void addFiles(Array.from(e.target.files ?? []))}
              >
                <FileUp /> Add files
              </FileButton>
              <Button size='sm' variant='ghost' onClick={() => setInput('')} disabled={!input}>
                <Eraser /> Clear
              </Button>
            </>
          }
        >
          <Textarea
            aria-label='Certificates (PEM)'
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              'Paste or drop the leaf, intermediates and (optionally) the root\n-----BEGIN CERTIFICATE-----\n...'
            }
          />
        </Panel>
        <Panel title='Chain'>
          {shown.result ? (
            <ChainReport result={shown.result} />
          ) : (
            <p className='p-2.5 text-xs text-muted-foreground'>
              Orders the certificates leaf to root and checks each signature, name and validity period locally. No trust
              store or revocation lookups.
            </p>
          )}
        </Panel>
      </Split>
    </DropTarget>
  )
}

type Conversion = 'pem-der' | 'der-pem' | 'p12-pem' | 'pem-p12'

function PemToDer() {
  const [input, setInput] = useToolState('cert-toolkit:pem-der', '')
  const blocks = useMemo(() => {
    try {
      return { list: input.trim() ? pemBlocks(input) : [] }
    } catch (e) {
      return { list: [], error: errorMessage(e) }
    }
  }, [input])
  const ext = (type: string) => (type === 'CERTIFICATE' ? 'cer' : type.includes('REQUEST') ? 'csr' : 'der')
  return (
    <>
      <Alert>{blocks.error || (input.trim() && !blocks.list.length && 'No PEM blocks found')}</Alert>
      <Split>
        <Panel title='PEM'>
          <Textarea
            aria-label='PEM'
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'-----BEGIN CERTIFICATE-----\n...'}
          />
        </Panel>
        <Panel title='DER files'>
          <ul className='text-xs'>
            {blocks.list.map((b, i) => (
              <li key={i} className='flex items-center gap-2 border-b py-1 pr-1 pl-2.5'>
                <span className='font-mono'>{b.type}</span>
                <span className='text-muted-foreground'>{filesize(b.der.byteLength, { base: 2 })}</span>
                <Button
                  size='sm'
                  variant='ghost'
                  className='ml-auto'
                  onClick={() =>
                    downloadBlob(b.der, `${b.type.toLowerCase().replace(/ /g, '-')}-${i + 1}.${ext(b.type)}`)
                  }
                >
                  <Download /> Download
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      </Split>
    </>
  )
}

function FileInput({
  file,
  onFile,
  accept,
  children,
}: {
  file?: File
  onFile: (f: File) => void
  accept: string
  children: string
}) {
  return (
    <DropZone
      className='py-5'
      accept={accept}
      onFiles={([f]) => f && onFile(f)}
      hint={file ? `${file.name}, ${filesize(file.size, { base: 2 })}` : 'Stays in your browser'}
    >
      {children}
    </DropZone>
  )
}

function DerToPem() {
  const [out, setOut] = useToolState('cert-toolkit:der-pem', { name: '', pem: '', error: '' })
  const load = async (f: File) => {
    try {
      setOut({ name: f.name, pem: derToPem(await f.arrayBuffer()), error: '' })
    } catch (e) {
      setOut({ name: f.name, pem: '', error: errorMessage(e) })
    }
  }
  return (
    <>
      <FileInput accept='.der,.cer,.crt,.csr,.key' onFile={(f) => void load(f)}>
        {out.name
          ? `Loaded ${out.name}; drop another DER file to convert`
          : 'Drop a DER file (certificate, CSR or key)'}
      </FileInput>
      <Alert>{out.error}</Alert>
      <PemPanel
        title='PEM'
        value={out.pem}
        filename={`${out.name.replace(/\.[^.]+$/, '') || 'converted'}.pem`}
        placeholder='The PEM appears here'
      />
    </>
  )
}

function Pkcs12ToPem() {
  const [file, setFile] = useState<File>()
  const [password, setPassword] = useState('')
  const [pem, setPem] = useToolState('cert-toolkit:p12-pem', '')
  const [error, setError] = useState('')
  const run = async () => {
    if (!file) return
    setError('')
    try {
      const { certs, keys } = pkcs12ToPem(await file.arrayBuffer(), password)
      setPem([...keys, ...certs].join(''))
    } catch (e) {
      setPem('')
      setError(errorMessage(e))
    }
  }
  return (
    <>
      <FileInput file={file} accept='.p12,.pfx' onFile={setFile}>
        Drop a PKCS#12 file (.p12, .pfx)
      </FileInput>
      <form
        className='flex flex-wrap items-end gap-2'
        onSubmit={(e) => {
          e.preventDefault()
          void run()
        }}
      >
        <Label className='flex w-64 flex-col gap-1'>
          Password
          <Input type='password' autoComplete='off' value={password} onChange={(e) => setPassword(e.target.value)} />
        </Label>
        <Button type='submit' disabled={!file}>
          Extract
        </Button>
      </form>
      <Alert>{error}</Alert>
      <PemPanel
        title='Private key and certificates'
        value={pem}
        filename='bundle.pem'
        placeholder='Extracted PEM appears here'
      />
    </>
  )
}

function PemToPkcs12() {
  const [input, setInput] = useToolState('cert-toolkit:pem-p12', '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const mismatch = confirm !== '' && confirm !== password
  const run = async () => {
    setError('')
    try {
      downloadBlob(await pemToPkcs12(input, password), 'bundle.p12', 'application/x-pkcs12')
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <>
      <Alert>{error}</Alert>
      <Split>
        <Panel title='Private key and certificates (PEM)'>
          <Textarea
            aria-label='Private key and certificates (PEM)'
            className={paneField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n-----BEGIN CERTIFICATE-----\n...'
            }
          />
        </Panel>
        <Panel title='PKCS#12'>
          <form
            className='flex max-w-sm flex-col gap-2.5 p-2.5'
            onSubmit={(e) => {
              e.preventDefault()
              void run()
            }}
          >
            <Label className='flex flex-col gap-1'>
              Password
              <Input
                type='password'
                autoComplete='new-password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Label>
            <Label className='flex flex-col gap-1'>
              Confirm password
              <Input
                type='password'
                autoComplete='new-password'
                value={confirm}
                aria-invalid={mismatch}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Label>
            {mismatch && <span className='text-xs text-destructive'>Passwords don't match</span>}
            <Button
              type='submit'
              size='sm'
              className='self-start'
              disabled={!input.trim() || !password || password !== confirm}
            >
              <Download /> Download .p12
            </Button>
            <p className='text-xs text-muted-foreground'>
              AES-256 with PBKDF2 and a SHA-256 MAC: opens in OpenSSL 3, Windows and macOS. The key's own certificate
              goes first; other certificates are added as the chain.
            </p>
          </form>
        </Panel>
      </Split>
    </>
  )
}

function Convert() {
  const [conversion, setConversion] = useToolState<Conversion>('cert-toolkit:conversion', 'pem-der')
  return (
    <>
      <div>
        <Segmented
          label='Conversion'
          value={conversion}
          onChange={setConversion}
          options={[
            ['pem-der', 'PEM → DER'],
            ['der-pem', 'DER → PEM'],
            ['p12-pem', 'PKCS#12 → PEM'],
            ['pem-p12', 'PEM → PKCS#12'],
          ]}
        />
      </div>
      {conversion === 'pem-der' && <PemToDer />}
      {conversion === 'der-pem' && <DerToPem />}
      {conversion === 'p12-pem' && <Pkcs12ToPem />}
      {conversion === 'pem-p12' && <PemToPkcs12 />}
    </>
  )
}

export default function CertToolkit() {
  const [mode, setMode] = useToolState<Mode>('cert-toolkit:mode', 'csr')
  return (
    <Workspace
      toolbar={
        <Segmented
          label='Mode'
          value={mode}
          onChange={setMode}
          options={[
            ['csr', 'Generate CSR'],
            ['self', 'Self-signed'],
            ['chain', 'Check chain'],
            ['convert', 'Convert'],
          ]}
        />
      }
    >
      {mode === 'csr' && <Generate selfSigned={false} />}
      {mode === 'self' && <Generate selfSigned />}
      {mode === 'chain' && <Chain />}
      {mode === 'convert' && <Convert />}
    </Workspace>
  )
}
