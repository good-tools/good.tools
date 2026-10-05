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
import { barcodeText, isLinear, SYMBOLOGIES, type Symbology } from '@/lib/barcode'
import { type Decoded, readCode, type Wifi, type WifiSecurity, wifiPayload } from '@/lib/qr'
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
  const [type, setType] = useToolState<Symbology>('qr:type', 'qrcode')
  const [level, setLevel] = useToolState<QRCodeErrorCorrectionLevel>('qr:level', 'M')
  const [size, setSize] = useToolState('qr:size', 512)
  const [humanText, setHumanText] = useToolState('qr:humanText', true)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  const isQr = type === 'qrcode'
  const wifiMode = isQr && content === 'wifi'
  const payload = wifiMode ? (wifi.ssid ? wifiPayload(wifi) : '') : text
  const options = { errorCorrectionLevel: level, margin: 4, width: size }
  const [, label, example] = SYMBOLOGIES.find(([id]) => id === type) ?? ['qrcode', 'QR Code', '']
  const file = isQr ? 'qr-code' : type

  // biome-ignore lint/correctness/useExhaustiveDependencies: options is rebuilt from level and size
  useEffect(() => {
    let current = true
    if (!payload) {
      setSvg('')
      setError('')
      return
    }
    const render = async () => {
      if (isQr) return QRCode.toString(payload, { ...options, type: 'svg' })
      const value = barcodeText(type, payload)
      // Not inside import().then(): Vite would treat our errors as chunk-load failures and reload
      const { barcodeSvg } = await import('@/lib/bwip')
      return barcodeSvg(type, value, humanText)
    }
    render()
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
  }, [payload, level, size, type, humanText])

  const downloadPng = async () => {
    if (!isQr) {
      const b = await import('@/lib/bwip')
      return downloadBlob(await b.barcodePng(type, barcodeText(type, payload), humanText, size), `${file}.png`)
    }
    const url = await QRCode.toDataURL(payload, options)
    downloadBlob(await (await fetch(url)).blob(), 'qr-code.png')
  }

  return (
    <Workspace
      toolbar={
        <>
          {modes}
          <select
            aria-label='Symbology'
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value as Symbology)}
          >
            {SYMBOLOGIES.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {isQr && (
            <>
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
            </>
          )}
          {isLinear(type) && (
            <Checkbox
              title='Human-readable text'
              checked={humanText}
              onChange={(e) => setHumanText(e.target.checked)}
            />
          )}
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
            <Button
              size='sm'
              onClick={() => downloadPng().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))}
              disabled={!svg}
            >
              <Download /> PNG
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => downloadBlob(svg, `${file}.svg`, 'image/svg+xml')}
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
          title={wifiMode ? 'Wi-Fi network' : isQr ? 'Text or URL' : 'Content'}
          actions={
            !wifiMode && (
              <Button size='sm' variant='ghost' onClick={() => setText('')} disabled={!text}>
                <Eraser /> Clear
              </Button>
            )
          }
        >
          {!wifiMode ? (
            <Textarea
              autoFocus
              aria-label={isQr ? 'Text or URL' : `${label} content`}
              className={paneField}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={example}
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
        <Panel title={label}>
          {svg ? (
            // Codes stay dark-on-white in both themes so every scanner can read them
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
              alt={`Generated ${label}`}
              className={cn(
                'mx-auto bg-white p-2',
                isQr ? 'h-full max-h-[min(100%,28rem)] w-auto' : 'my-2 max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)]',
              )}
            />
          ) : (
            <p className='p-2.5 text-xs text-muted-foreground'>The {label} appears here as you type</p>
          )}
        </Panel>
      </Split>
    </Workspace>
  )
}

function Read({ modes }: { modes: ReactNode }) {
  const [result, setResult] = useToolState<Decoded | null>('qr:decoded', null)
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
        const found = await readCode(bitmap)
        bitmap.close()
        setResult(found)
        if (!found) setError('No QR code or barcode found in this image')
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
      const found = v && v.readyState >= 2 ? await readCode(v).catch(() => null) : null
      if (stopped) return
      if (found) {
        setResult(found)
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
              <img src={image} alt='Uploaded code' className='min-h-0 flex-1 rounded-md object-contain' />
            )}
            {!camera && (
              <DropZone
                className={image ? 'py-3' : 'flex-1'}
                accept='image/*'
                onFiles={([f]) => f && void readFile(f)}
                hint='Or paste an image (Ctrl+V). Read on your device; nothing is uploaded.'
              >
                Drop an image with a QR code or barcode, or click to browse
              </DropZone>
            )}
          </div>
        </Panel>
        <Panel
          title={result ? `Content · ${result.format}` : 'Content'}
          actions={<CopyButton value={result?.text ?? ''} disabled={!result?.text} />}
        >
          <Textarea
            readOnly
            aria-label='Decoded content'
            className={cn(paneField, 'break-all')}
            value={result?.text ?? ''}
            placeholder='The decoded text appears here'
          />
        </Panel>
      </Split>
    </Workspace>
  )
}
