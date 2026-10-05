import { Camera, CameraOff, Download, Eraser } from 'lucide-react'
import QRCode, { type QRCodeErrorCorrectionLevel } from 'qrcode'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { DropZone } from '@/components/ui/drop-zone'
import { fieldClass, Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Panel, paneField, Split, Workspace } from '@/components/ui/toolbar'
import { useToolState } from '@/hooks/useToolState'
import { readQr, type Wifi, type WifiSecurity, wifiPayload } from '@/lib/qr'
import { cn, downloadBlob } from '@/lib/utils'

type Mode = 'generate' | 'read'
type Content = 'text' | 'wifi'

const selectClass = cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')
const SIZES = [256, 512, 1024, 2048]

export default function QrCode() {
  const [mode, setMode] = useToolState<Mode>('qr:mode', 'generate')
  const modes = (
    <Segmented<Mode>
      label='Mode'
      value={mode}
      onChange={setMode}
      options={[
        ['generate', 'Generate'],
        ['read', 'Read'],
      ]}
    />
  )
  return mode === 'generate' ? <Generate modes={modes} /> : <Read modes={modes} />
}

function Generate({ modes }: { modes: ReactNode }) {
  const [content, setContent] = useToolState<Content>('qr:content', 'text')
  const [text, setText] = useToolState('qr:text', '')
  const [wifi, setWifi] = useToolState<Wifi>('qr:wifi', { ssid: '', password: '', security: 'WPA', hidden: false })
  const [level, setLevel] = useToolState<QRCodeErrorCorrectionLevel>('qr:level', 'M')
  const [size, setSize] = useToolState('qr:size', 512)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  const payload = content === 'text' ? text : wifi.ssid ? wifiPayload(wifi) : ''
  const options = { errorCorrectionLevel: level, margin: 4, width: size }

  // biome-ignore lint/correctness/useExhaustiveDependencies: options is rebuilt from level and size
  useEffect(() => {
    let current = true
    if (!payload) {
      setSvg('')
      setError('')
      return
    }
    QRCode.toString(payload, { ...options, type: 'svg' })
      .then((s) => {
        if (!current) return
        setSvg(s)
        setError('')
      })
      .catch((e: unknown) => {
        if (!current) return
        setSvg('')
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      current = false
    }
  }, [payload, level, size])

  const downloadPng = async () => {
    const url = await QRCode.toDataURL(payload, options)
    downloadBlob(await (await fetch(url)).blob(), 'qr-code.png')
  }

  return (
    <Workspace
      toolbar={
        <>
          {modes}
          <Segmented<Content>
            label='Content'
            value={content}
            onChange={setContent}
            options={[
              ['text', 'Text / URL'],
              ['wifi', 'Wi-Fi'],
            ]}
          />
          <select
            aria-label='Error correction'
            title='Higher levels survive more damage but make a denser code'
            className={selectClass}
            value={level}
            onChange={(e) => setLevel(e.target.value as QRCodeErrorCorrectionLevel)}
          >
            <option value='L'>Low (7%)</option>
            <option value='M'>Medium (15%)</option>
            <option value='Q'>Quartile (25%)</option>
            <option value='H'>High (30%)</option>
          </select>
          <select
            aria-label='PNG size'
            className={selectClass}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s} px
              </option>
            ))}
          </select>
          <div className='ml-auto flex gap-1.5'>
            <Button size='sm' onClick={() => void downloadPng()} disabled={!svg}>
              <Download /> PNG
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => downloadBlob(svg, 'qr-code.svg', 'image/svg+xml')}
              disabled={!svg}
            >
              <Download /> SVG
            </Button>
          </div>
        </>
      }
    >
      <Alert>{error}</Alert>
      <Split>
        <Panel
          title={content === 'text' ? 'Text or URL' : 'Wi-Fi network'}
          actions={
            content === 'text' && (
              <Button size='sm' variant='ghost' onClick={() => setText('')} disabled={!text}>
                <Eraser /> Clear
              </Button>
            )
          }
        >
          {content === 'text' ? (
            <Textarea
              autoFocus
              aria-label='Text or URL'
              className={paneField}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='https://good.tools'
            />
          ) : (
            <div className='grid gap-3 p-2.5'>
              <div className='grid gap-1'>
                <Label htmlFor='qr-ssid'>Network name (SSID)</Label>
                <Input
                  id='qr-ssid'
                  autoFocus
                  value={wifi.ssid}
                  onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
                />
              </div>
              <div className='grid gap-1'>
                <Label htmlFor='qr-security'>Security</Label>
                <select
                  id='qr-security'
                  className={cn(fieldClass, 'h-8 py-0')}
                  value={wifi.security}
                  onChange={(e) => setWifi({ ...wifi, security: e.target.value as WifiSecurity })}
                >
                  <option value='WPA'>WPA / WPA2 / WPA3</option>
                  <option value='WEP'>WEP</option>
                  <option value='nopass'>None (open)</option>
                </select>
              </div>
              {wifi.security !== 'nopass' && (
                <div className='grid gap-1'>
                  <Label htmlFor='qr-password'>Password</Label>
                  <Input
                    id='qr-password'
                    value={wifi.password}
                    onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                  />
                </div>
              )}
              <Checkbox
                title='Hidden network'
                checked={wifi.hidden}
                onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })}
              />
            </div>
          )}
        </Panel>
        <Panel title='QR code'>
          {svg ? (
            // QR codes stay dark-on-white in both themes so every scanner can read them
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
              alt='Generated QR code'
              className='mx-auto h-full max-h-[min(100%,28rem)] w-auto bg-white p-2'
            />
          ) : (
            <p className='p-2.5 text-xs text-muted-foreground'>The QR code appears here as you type</p>
          )}
        </Panel>
      </Split>
    </Workspace>
  )
}

function Read({ modes }: { modes: ReactNode }) {
  const [result, setResult] = useToolState<string | null>('qr:result', null)
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [camera, setCamera] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  const readFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return setError(`${file.name} is not an image`)
      setCamera(false)
      setBusy(true)
      setError('')
      setImage(URL.createObjectURL(file))
      try {
        const bitmap = await createImageBitmap(file)
        const text = await readQr(bitmap)
        bitmap.close()
        setResult(text)
        if (text === null) setError('No QR code found in this image')
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [setResult],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files[0]
      if (file) void readFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [readFile])

  // Scan the camera feed a few times a second until a code is found
  useEffect(() => {
    if (!camera) return
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const scan = async () => {
      const v = video.current
      const text = v && v.readyState >= 2 ? await readQr(v).catch(() => null) : null
      if (stopped) return
      if (text !== null) {
        setResult(text)
        setCamera(false)
      } else timer = setTimeout(() => void scan(), 250)
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s
        if (stopped) {
          for (const t of s.getTracks()) t.stop()
          return
        }
        if (video.current) video.current.srcObject = s
        setError('')
        setImage(null)
        void scan()
      })
      .catch((e: unknown) => {
        setCamera(false)
        setError(`Camera unavailable: ${e instanceof Error ? e.message : String(e)}`)
      })
    return () => {
      stopped = true
      clearTimeout(timer)
      for (const t of stream?.getTracks() ?? []) t.stop()
    }
  }, [camera, setResult])

  useEffect(() => () => void (image && URL.revokeObjectURL(image)), [image])

  return (
    <Workspace
      toolbar={
        <>
          {modes}
          <Button size='sm' variant={camera ? 'default' : 'ghost'} onClick={() => setCamera(!camera)}>
            {camera ? <CameraOff /> : <Camera />} {camera ? 'Stop camera' : 'Use camera'}
          </Button>
          {busy && <Spinner label='Reading…' />}
        </>
      }
    >
      <Alert>{error}</Alert>
      <Split>
        <Panel title='Image'>
          <div className='flex h-full flex-col gap-2 p-2'>
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              className={cn('min-h-0 flex-1 rounded-md', !camera && 'hidden')}
            />
            {!camera && image && (
              <img src={image} alt='Uploaded QR code' className='min-h-0 flex-1 rounded-md object-contain' />
            )}
            {!camera && (
              <DropZone
                className={image ? 'py-3' : 'flex-1'}
                accept='image/*'
                onFiles={([f]) => f && void readFile(f)}
                hint='Or paste an image (Ctrl+V). Read on your device; nothing is uploaded.'
              >
                Drop an image with a QR code or click to browse
              </DropZone>
            )}
          </div>
        </Panel>
        <Panel title='Content' actions={<CopyButton value={result ?? ''} disabled={!result} />}>
          <Textarea
            readOnly
            aria-label='Decoded content'
            className={cn(paneField, 'break-all')}
            value={result ?? ''}
            placeholder='The decoded text appears here'
          />
        </Panel>
      </Split>
    </Workspace>
  )
}
