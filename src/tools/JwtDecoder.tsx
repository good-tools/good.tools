import { Check, Eraser, FlaskConical, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { CLAIM_NAMES, type DecodedJwt, decodeJwt, isHmac, TIME_CLAIMS, timeValidity, verifyJwt } from '@/lib/jwt'
import { cn, formatDateTime, formatRelative } from '@/lib/utils'

const EXAMPLE_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30'
const EXAMPLE_SECRET = 'a-string-secret-at-least-256-bits-long'

// The three parts are colour-coded in the token and in the matching panel titles (like jwt.io)
const PART_COLORS = [
  'text-rose-600 dark:text-rose-400',
  'text-violet-600 dark:text-violet-400',
  'text-sky-600 dark:text-sky-400',
] as const

type View = 'json' | 'claims'
type Verification =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'done'; valid: boolean }
  | { state: 'error'; message: string }

/** Textarea with a colour-highlighted copy of its text layered underneath. */
function TokenEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const backdrop = useRef<HTMLPreElement>(null)
  const segments = value.split('.')
  const shared = 'p-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap'

  return (
    <div className='relative h-full'>
      <pre
        ref={backdrop}
        aria-hidden='true'
        className={cn(shared, 'pointer-events-none absolute inset-0 overflow-hidden')}
      >
        {segments.map((seg, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
          <span key={i}>
            {i > 0 && <span className='text-muted-foreground'>.</span>}
            <span className={PART_COLORS[i] ?? 'text-destructive'}>{seg}</span>
          </span>
        ))}
        {'\n'}
      </pre>
      <Textarea
        autoFocus
        aria-label='Encoded JWT'
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\s+/g, ''))}
        onScroll={(e) => {
          if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop
        }}
        placeholder='Paste a token: eyJhbGciOi…'
        className={cn(paneField, shared, 'relative text-transparent caret-foreground selection:bg-foreground/20')}
      />
    </div>
  )
}

function formatClaim(key: string, value: unknown) {
  if (TIME_CLAIMS.has(key) && typeof value === 'number') {
    return (
      <span className='flex flex-col'>
        <span>{formatDateTime(value * 1000)}</span>
        <span className='text-muted-foreground'>
          {formatRelative(value * 1000)} · {value}
        </span>
      </span>
    )
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function DecodedPanel({
  title,
  color,
  value,
  view,
  onView,
  extra,
}: {
  title: string
  color: string
  value: unknown
  view: View
  onView: (v: View) => void
  extra?: React.ReactNode
}) {
  const json = JSON.stringify(value, null, 2)
  const entries = typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.entries(value) : null

  return (
    <Panel
      className='shrink-0'
      title={
        <span className='flex items-center gap-2'>
          <span className={cn('size-1.5 rounded-full bg-current', color)} />
          {title}
          {extra}
        </span>
      }
      actions={
        <>
          <Segmented<View>
            label={`${title} view`}
            value={view}
            onChange={onView}
            options={[
              ['json', 'JSON'],
              ['claims', 'Claims'],
            ]}
          />
          <CopyButton size='icon-sm' label={`Copy ${title.toLowerCase()}`} value={json} />
        </>
      }
    >
      {view === 'claims' && entries ? (
        <table className='w-full text-xs'>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className='border-b last:border-0 align-top'>
                <td className='w-36 py-1.5 pr-2 pl-2.5'>
                  <span className='font-mono'>{k}</span>
                  {CLAIM_NAMES[k] && <span className='block text-muted-foreground'>{CLAIM_NAMES[k]}</span>}
                </td>
                <td className='py-1.5 pr-2.5 font-mono break-all'>{formatClaim(k, v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <pre className='p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all'>{json}</pre>
      )}
    </Panel>
  )
}

export default function JwtDecoder() {
  const [token, setToken] = useToolState('jwt:token', '')
  const [key, setKey] = useToolState('jwt:key', '')
  const [secretBase64Url, setSecretBase64Url] = useToolState('jwt:secretBase64Url', false)
  const [headerView, setHeaderView] = useToolState<View>('jwt:headerView', 'json')
  const [payloadView, setPayloadView] = useToolState<View>('jwt:payloadView', 'claims')
  const [verification, setVerification] = useState<Verification>({ state: 'idle' })

  const decoded = useMemo((): { jwt?: DecodedJwt; error?: string } => {
    if (!token) return {}
    try {
      return { jwt: decodeJwt(token) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [token])

  const alg = decoded.jwt?.header.alg
  const hmac = isHmac(alg)
  const validity = timeValidity(decoded.jwt?.payload)

  useEffect(() => {
    if (!decoded.jwt || !key.trim()) return setVerification({ state: 'idle' })
    let stale = false
    setVerification({ state: 'checking' })
    verifyJwt(token, key, { secretBase64Url }).then(
      (valid) => !stale && setVerification({ state: 'done', valid }),
      (e: unknown) =>
        !stale && setVerification({ state: 'error', message: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      stale = true
    }
  }, [decoded.jwt, token, key, secretBase64Url])

  return (
    <Workspace
      toolbar={
        <>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              setToken(EXAMPLE_TOKEN)
              setKey(EXAMPLE_SECRET)
              setSecretBase64Url(false)
            }}
          >
            <FlaskConical /> Load example
          </Button>
          <Button
            size='sm'
            variant='ghost'
            disabled={!token && !key}
            onClick={() => {
              setToken('')
              setKey('')
            }}
          >
            <Eraser /> Clear
          </Button>
          <div className='ml-auto flex items-center gap-1.5'>
            {decoded.jwt && (
              <Badge variant='success'>
                <Check /> Valid JWT
              </Badge>
            )}
            {decoded.error && (
              <Badge variant='destructive'>
                <X /> Invalid JWT
              </Badge>
            )}
            {verification.state === 'done' &&
              (verification.valid ? (
                <Badge variant='success'>
                  <ShieldCheck /> Signature verified
                </Badge>
              ) : (
                <Badge variant='destructive'>
                  <ShieldAlert /> Invalid signature
                </Badge>
              ))}
          </div>
        </>
      }
    >
      <Alert>{decoded.error}</Alert>
      <Split>
        <Panel
          title={
            <span className='flex items-center gap-2'>
              Encoded token
              {typeof alg === 'string' && <Badge variant='outline'>{alg}</Badge>}
            </span>
          }
          actions={<CopyButton size='icon-sm' label='Copy token' value={token} disabled={!token} />}
        >
          <TokenEditor value={token} onChange={setToken} />
        </Panel>

        <div className='flex min-h-0 flex-col gap-2 overflow-y-auto'>
          {decoded.jwt ? (
            <>
              <DecodedPanel
                title='Header'
                color={PART_COLORS[0]}
                value={decoded.jwt.header}
                view={headerView}
                onView={setHeaderView}
              />
              <DecodedPanel
                title='Payload'
                color={PART_COLORS[1]}
                value={decoded.jwt.payload}
                view={payloadView}
                onView={setPayloadView}
                extra={
                  validity &&
                  validity !== 'valid' && (
                    <Badge variant='warning' className='normal-case tracking-normal'>
                      {validity === 'expired' ? 'Expired' : 'Not yet valid'}
                    </Badge>
                  )
                }
              />
              <Panel
                className='shrink-0'
                title={
                  <span className='flex items-center gap-2'>
                    <span className={cn('size-1.5 rounded-full bg-current', PART_COLORS[2])} />
                    Verify signature
                  </span>
                }
                actions={
                  hmac && (
                    <Checkbox
                      title='Secret is base64url-encoded'
                      checked={secretBase64Url}
                      onChange={(e) => setSecretBase64Url(e.target.checked)}
                    />
                  )
                }
              >
                <Textarea
                  aria-label={hmac ? 'Secret' : 'Public key'}
                  rows={hmac ? 2 : 6}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={
                    alg === 'none'
                      ? 'This token is unsigned (alg "none"), so there is nothing to verify'
                      : hmac
                        ? `Secret used to sign the token (${String(alg)})`
                        : `Public key for ${String(alg)}: PEM (-----BEGIN PUBLIC KEY-----) or JWK`
                  }
                  disabled={alg === 'none'}
                  className={cn(paneField, 'h-auto min-h-0')}
                />
                <div className='flex min-h-8 items-center gap-2 border-t px-2.5 text-xs'>
                  {verification.state === 'idle' && (
                    <span className='text-muted-foreground'>
                      {hmac ? 'Enter the secret' : 'Paste the public key'} to verify the signature. Nothing leaves your
                      browser.
                    </span>
                  )}
                  {verification.state === 'checking' && <Spinner label='Verifying…' />}
                  {verification.state === 'done' &&
                    (verification.valid ? (
                      <span className='flex items-center gap-1.5 text-success'>
                        <ShieldCheck className='size-3.5' /> Signature verified
                      </span>
                    ) : (
                      <span className='flex items-center gap-1.5 text-destructive'>
                        <ShieldAlert className='size-3.5' /> Signature does not match this {hmac ? 'secret' : 'key'}
                      </span>
                    ))}
                  {verification.state === 'error' && <span className='text-destructive'>{verification.message}</span>}
                </div>
              </Panel>
            </>
          ) : (
            <div className='flex flex-1 items-center justify-center rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground'>
              Paste a JWT to decode its header and payload and verify its signature.
              <br />
              Decoding and verification run entirely in your browser.
            </div>
          )}
        </div>
      </Split>
    </Workspace>
  )
}
