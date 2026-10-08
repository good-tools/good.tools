import { Bounds, OrbitControls, useBounds } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { filesize } from 'filesize'
import { Download, FolderOpen, Maximize, Trash2, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropTarget, DropZone } from '@/components/ui/drop-zone'
import { FileButton } from '@/components/ui/file-button'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Workspace } from '@/components/ui/toolbar'
import { setToolState, useToolState } from '@/hooks/useToolState'
import {
  CAD_ACCEPT,
  type CadFormat,
  type CadModel,
  cadFormat,
  cadStats,
  disposeMesh,
  flattenTree,
  toGlb,
  toStl,
  toThreeMesh,
} from '@/lib/cad'
import { downloadBlob } from '@/lib/utils'
import type { CadRequest, CadResponse } from '@/workers/cad.worker'

interface Loaded {
  name: string
  size: number
  format: CadFormat
  model: CadModel
}

/** Re-fits the camera whenever `fit` changes (Bounds also fits once on mount). */
function FitOn({ fit }: { fit: number }) {
  const bounds = useBounds()
  // biome-ignore lint/correctness/useExhaustiveDependencies: `fit` is the trigger
  useEffect(() => {
    if (fit) bounds.refresh().clip().fit()
  }, [fit])
  return null
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function StepViewer() {
  const [file, setFile] = useToolState<Loaded | null>('step:file', null)
  const [hidden, setHidden] = useToolState<number[]>('step:hidden', [])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fit, setFit] = useState(0)
  const navigate = useNavigate()

  const workerRef = useRef<Worker | null>(null)
  const requestId = useRef(0)
  const pending = useRef<{ name: string; size: number; format: CadFormat } | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../workers/cad.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onerror = (e) => setError(`CAD engine failed to load: ${e.message}`)
    worker.onmessage = ({ data: msg }: MessageEvent<CadResponse>) => {
      if (msg.type === 'ready') return setReady(true)
      if (msg.id !== undefined && msg.id !== requestId.current) return // stale (another file was opened)
      setBusy(null)
      if (msg.type === 'error') return setError(msg.error)
      if (pending.current) {
        setHidden([])
        setFile({ ...pending.current, model: msg.model })
      }
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [setFile, setHidden])

  const meshes = useMemo(() => file?.model.meshes.map(toThreeMesh) ?? [], [file])
  useEffect(() => () => meshes.forEach(disposeMesh), [meshes])

  const rows = useMemo(() => (file ? flattenTree(file.model) : []), [file])
  const hiddenSet = useMemo(() => new Set(hidden), [hidden])
  const visibleMeshes = useMemo(() => meshes.filter((_, i) => !hiddenSet.has(i)), [meshes, hiddenSet])
  const stats = useMemo(
    () => file && cadStats(file.model.meshes.filter((_, i) => !hiddenSet.has(i))),
    [file, hiddenSet],
  )

  const open = async (f: File | undefined) => {
    if (!f || !workerRef.current) return
    const format = cadFormat(f.name)
    if (!format) return setError(`${f.name} is not a STEP, IGES or BREP file`)
    const data = new Uint8Array(await f.arrayBuffer())
    pending.current = { name: f.name, size: f.size, format }
    setError(null)
    setBusy(`Tessellating ${f.name}…`)
    const msg: CadRequest = { id: ++requestId.current, format, data }
    workerRef.current.postMessage(msg, [data.buffer])
  }

  const clear = () => {
    requestId.current++
    setBusy(null)
    setError(null)
    setFile(null)
    setHidden([])
  }

  const toggle = (ids: number[], show: boolean) =>
    setHidden((h) => (show ? h.filter((i) => !ids.includes(i)) : [...new Set([...h, ...ids])]))

  const base = file?.name.replace(/\.[^.]+$/, '') ?? 'model'

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  const exportStl = () =>
    run('Exporting STL…', async () => downloadBlob(await toStl(visibleMeshes), `${base}.stl`, 'model/stl'))
  const exportGlb = () =>
    run('Exporting GLB…', async () => downloadBlob(await toGlb(visibleMeshes), `${base}.glb`, 'model/gltf-binary'))
  const openInRepair = () =>
    run('Preparing STL…', async () => {
      setToolState('stl:file', { name: `${base}.stl`, data: await toStl(visibleMeshes) })
      setToolState('stl:repaired', null)
      await navigate('/stl-repair')
    })

  const fileButton = (
    <FileButton
      size='sm'
      variant='ghost'
      accept={CAD_ACCEPT}
      disabled={!ready}
      onFileSelected={(e) => void open(e.target.files?.[0])}
    >
      <FolderOpen /> Open
    </FileButton>
  )

  if (!file)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          accept={CAD_ACCEPT}
          disabled={!ready || !!busy}
          onFiles={([f]) => void open(f)}
          hint='STEP (.step, .stp), IGES (.igs, .iges) or BREP — tessellated locally with OpenCascade'
        >
          Drop a CAD file here or click to browse
        </DropZone>
        {!ready && !error && <Spinner label='Loading CAD engine…' />}
        {busy && <Spinner label={busy} />}
        <Alert>{error}</Alert>
      </div>
    )

  const unit = file.format === 'brep' ? '' : ' mm'
  return (
    <Workspace
      toolbar={
        <>
          {fileButton}
          <Button size='sm' variant='ghost' onClick={() => setFit((n) => n + 1)} disabled={!visibleMeshes.length}>
            <Maximize /> Fit
          </Button>
          <Button size='sm' variant='outline' onClick={exportStl} disabled={!visibleMeshes.length || !!busy}>
            <Download /> STL
          </Button>
          <Button size='sm' variant='outline' onClick={exportGlb} disabled={!visibleMeshes.length || !!busy}>
            <Download /> GLB
          </Button>
          <Button size='sm' variant='ghost' onClick={openInRepair} disabled={!visibleMeshes.length || !!busy}>
            <Wrench /> Open in STL Repair
          </Button>
          <Button size='sm' variant='ghost' onClick={clear}>
            <Trash2 /> Clear
          </Button>
          {busy && <Spinner label={busy} />}
          <span className='ml-auto flex min-w-0 items-center gap-2 text-xs text-muted-foreground'>
            <span className='truncate font-medium text-foreground' title={file.name}>
              {file.name}
            </span>
            {filesize(file.size, { base: 2 })}
          </span>
        </>
      }
    >
      <Alert>{error}</Alert>
      <DropTarget
        label='Drop to open'
        className='grid min-h-0 flex-1 gap-2 max-lg:grid-rows-[2fr_1fr] lg:grid-cols-[minmax(0,1fr)_18rem]'
        onFiles={([f]) => void open(f)}
      >
        <Panel title='Model' className='h-full'>
          <div className='relative h-full min-h-48 bg-muted/30'>
            <Canvas camera={{ position: [1, 0.8, 1.2], fov: 45 }} aria-label='3D view of the model'>
              <hemisphereLight args={['#ffffff', '#52525b', 1.1]} />
              <directionalLight position={[10, 14, 8]} intensity={1.4} />
              <directionalLight position={[-8, -4, -10]} intensity={0.4} />
              <Bounds fit clip margin={1.2}>
                {visibleMeshes.map((m) => (
                  <primitive key={m.uuid} object={m} />
                ))}
                <FitOn fit={fit} />
              </Bounds>
              <OrbitControls makeDefault enableDamping={false} />
            </Canvas>
          </div>
        </Panel>
        <div className='flex min-h-0 flex-col gap-2'>
          <Panel title={`Parts (${meshes.length})`} className='min-h-0 flex-1'>
            <ul className='py-1 text-xs'>
              {rows.map((r) => {
                const shown = r.meshes.filter((i) => !hiddenSet.has(i)).length
                return (
                  <li key={r.key} className='flex h-6 items-center px-2.5' style={{ paddingLeft: 10 + r.depth * 14 }}>
                    <Checkbox
                      className='min-w-0 text-xs [&>span]:truncate'
                      title={r.name}
                      checked={shown === r.meshes.length}
                      ref={(el: HTMLInputElement | null) => {
                        if (el) el.indeterminate = shown > 0 && shown < r.meshes.length
                      }}
                      onChange={(e) => toggle(r.meshes, e.target.checked)}
                    />
                  </li>
                )
              })}
            </ul>
          </Panel>
          {stats && (
            <Panel title='Statistics' className='shrink-0'>
              <table className='w-full text-xs'>
                <tbody>
                  {[
                    [
                      'Parts',
                      stats.parts === meshes.length ? fmt(stats.parts) : `${fmt(stats.parts)} of ${fmt(meshes.length)}`,
                    ],
                    ['Triangles', fmt(stats.triangles)],
                    ...(stats.size
                      ? (['X', 'Y', 'Z'] as const).map((a, i) => [
                          `Size ${a}`,
                          `${fmt(stats.size?.getComponent(i) ?? 0)}${unit}`,
                        ])
                      : []),
                  ].map(([label, value]) => (
                    <tr key={label} className='h-7 border-b last:border-0'>
                      <th className='px-2.5 text-left font-medium text-muted-foreground'>{label}</th>
                      <td className='px-2.5 text-right font-mono'>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </DropTarget>
    </Workspace>
  )
}
