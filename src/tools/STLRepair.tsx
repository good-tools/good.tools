import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Trash2, Wrench } from 'lucide-react'
import { filesize } from 'filesize'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { PRESETS, type RepairOptions, type RepairResult } from '@goodtools/meshrepair'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { DropZone } from '@/components/ui/drop-zone'
import { Input, fieldClass } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Panel, Split, Workspace } from '@/components/ui/toolbar'
import { cn, downloadBlob } from '@/lib/utils'
import type { MeshRepairRequest, MeshRepairResponse } from '@/workers/meshrepair.worker'

type PresetName = keyof typeof PRESETS | 'custom'

// Shared camera state so the repaired viewer follows the original one
interface CameraState {
  position: THREE.Vector3
  target: THREE.Vector3
}

interface Model {
  geometry: THREE.BufferGeometry
  /** Translation that centres the original model at the origin (shared by both viewers) */
  offset: THREE.Vector3
  radius: number
}

const OPTION_LABELS: [keyof RepairOptions, string][] = [
  ['fillHoles', 'Fill holes'],
  ['fixNormalOrientation', 'Fix normal orientation'],
  ['flipNormalsOutside', 'Flip normals outside'],
  ['removeNonManifoldFace', 'Remove non-manifold faces'],
  ['removeNonManifoldVertex', 'Remove non-manifold vertices'],
  ['removeTVertexByFlip', 'Remove T-vertices'],
  ['binaryOutput', 'Binary output'],
]

function CameraSync({ state, isLeader, radius }: { state: CameraState; isLeader: boolean; radius: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null)

  // Fit the model: distance at which the bounding sphere fills the vertical field of view
  useEffect(() => {
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.1
    camera.near = distance / 1000
    camera.far = distance * 100
    camera.updateProjectionMatrix()
    if (isLeader) {
      // three-quarter view so faces read as 3D rather than a flat silhouette
      camera.position.set(1, 0.8, 1.2).normalize().multiplyScalar(distance)
      camera.lookAt(0, 0, 0)
      controls.current?.target.set(0, 0, 0)
      controls.current?.update()
    }
  }, [camera, radius, isLeader])

  useFrame(() => {
    if (!controls.current) return
    if (isLeader) {
      state.position.copy(camera.position)
      state.target.copy(controls.current.target)
    } else {
      camera.position.copy(state.position)
      controls.current.target.copy(state.target)
      controls.current.update()
    }
  })

  return (
    <OrbitControls ref={controls as React.Ref<never>} enableDamping={false} enabled={isLeader} makeDefault={isLeader} />
  )
}

function Viewer({
  title,
  geometry,
  model,
  camera,
  isLeader,
  busy,
}: {
  title: string
  geometry: THREE.BufferGeometry | null
  model: Model
  camera: CameraState
  isLeader: boolean
  busy?: React.ReactNode
}) {
  // STLLoader output is non-indexed: every triangle has its own 3 vertices
  const triangles = geometry ? geometry.getAttribute('position').count / 3 : 0
  return (
    <Panel
      title={title}
      actions={
        geometry && <span className='px-1.5 text-xs text-muted-foreground'>{triangles.toLocaleString()} triangles</span>
      }
      className='h-full'
    >
      <div className='relative h-full min-h-48 bg-muted/30'>
        {busy ? (
          <div className='absolute inset-0 flex items-center justify-center'>{busy}</div>
        ) : geometry ? (
          <Canvas camera={{ position: [0, 0, 100], fov: 50 }}>
            <hemisphereLight args={['#ffffff', '#52525b', 1.1]} />
            <directionalLight position={[10, 14, 8]} intensity={1.4} />
            <directionalLight position={[-8, -4, -10]} intensity={0.4} />
            <mesh geometry={geometry} position={model.offset}>
              <meshStandardMaterial color='#a1a1aa' flatShading />
            </mesh>
            <CameraSync state={camera} isLeader={isLeader} radius={model.radius} />
          </Canvas>
        ) : (
          <div className='absolute inset-0 flex items-center justify-center text-xs text-muted-foreground'>
            Run a repair to see the result
          </div>
        )}
      </div>
    </Panel>
  )
}

function RepairStats({ result }: { result: RepairResult }) {
  const stats = [
    ['Duplicate vertices removed', result.duplicateVerticesRemoved],
    ['Duplicate faces removed', result.duplicateFacesRemoved],
    ['Unreferenced vertices removed', result.unreferencedVerticesRemoved],
    ['Degenerate faces removed', result.degenerateFacesRemoved],
    ['Non-manifold faces removed', result.nonManifoldFacesRemoved],
    ['Non-manifold vertices removed', result.nonManifoldVerticesRemoved],
    ['Holes filled', result.holesFilled],
    ['Faces', `${result.originalFaces.toLocaleString()} → ${result.finalFaces.toLocaleString()}`],
    ['Vertices', `${result.originalVertices.toLocaleString()} → ${result.finalVertices.toLocaleString()}`],
  ] as const
  const changed = stats.slice(0, 7).some(([, v]) => v !== 0)

  return (
    <Panel title='Repair statistics' className='shrink-0'>
      <table className='w-full text-xs'>
        <tbody>
          {!changed && (
            <tr className='h-7 border-b'>
              <td colSpan={2} className='px-2.5 text-success'>
                Mesh is already clean, nothing to repair.
              </td>
            </tr>
          )}
          {stats
            .filter(([, v]) => v !== 0)
            .map(([label, value]) => (
              <tr key={label} className='h-7 border-b last:border-0'>
                <th className='px-2.5 text-left font-medium text-muted-foreground'>{label}</th>
                <td className='px-2.5 text-right font-mono'>
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </Panel>
  )
}

const parseSTL = (buffer: ArrayBuffer) => new STLLoader().parse(buffer)

function STLRepair() {
  const [file, setFile] = useState<{ name: string; data: Uint8Array } | null>(null)
  const [model, setModel] = useState<Model | null>(null)
  const [repaired, setRepaired] = useState<{ data: Uint8Array<ArrayBuffer>; result: RepairResult } | null>(null)
  const repairedGeometry = useMemo(() => (repaired ? parseSTL(repaired.data.slice().buffer) : null), [repaired])

  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<{ step: string; value: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [preset, setPreset] = useState<PresetName>('print-ready')
  const [options, setOptions] = useState<RepairOptions>({ ...PRESETS['print-ready'] })

  const camera = useRef<CameraState>({ position: new THREE.Vector3(), target: new THREE.Vector3() })
  const workerRef = useRef<Worker | null>(null)
  const requestId = useRef(0)

  // Free GPU buffers when a geometry is replaced or the tool unmounts
  useEffect(() => () => model?.geometry.dispose(), [model])
  useEffect(() => () => repairedGeometry?.dispose(), [repairedGeometry])

  useEffect(() => {
    const worker = new Worker(new URL('../workers/meshrepair.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onerror = (e) => setError(`Mesh repair worker failed to load: ${e.message}`)
    worker.onmessage = ({ data: msg }: MessageEvent<MeshRepairResponse>) => {
      if (msg.type === 'ready') return setReady(true)
      if (msg.id !== undefined && msg.id !== requestId.current) return // stale (file changed / cleared)
      if (msg.type === 'progress') return setProgress({ step: msg.step, value: msg.value })
      setProgress(null)
      if (msg.type === 'error') setError(`Repair failed: ${msg.error}`)
      else setRepaired({ data: msg.output, result: msg.result })
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const handleFile = async ([f]: File[]) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.stl')) return setError(`${f.name} is not an STL file`)
    requestId.current++
    setError(null)
    setRepaired(null)
    setProgress(null)
    try {
      const buffer = await f.arrayBuffer()
      const geometry = parseSTL(buffer)
      geometry.computeBoundingSphere()
      const sphere = geometry.boundingSphere ?? new THREE.Sphere()
      setFile({ name: f.name, data: new Uint8Array(buffer) })
      setModel({ geometry, offset: sphere.center.clone().negate(), radius: sphere.radius || 1 })
    } catch (err) {
      setError(`Failed to parse STL: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const repair = () => {
    if (!file || !workerRef.current) return
    const data = file.data.slice() // transferred to the worker
    const msg: MeshRepairRequest = { id: ++requestId.current, name: file.name, data, options }
    setError(null)
    setRepaired(null)
    setProgress({ step: 'Starting...', value: 0 })
    workerRef.current.postMessage(msg, [data.buffer])
  }

  const clear = () => {
    requestId.current++
    setFile(null)
    setModel(null)
    setRepaired(null)
    setProgress(null)
    setError(null)
  }

  const setOption = (key: keyof RepairOptions, value: boolean | number) => {
    setPreset('custom')
    setOptions((o) => ({ ...o, [key]: value }))
  }

  const busy = progress && (
    <div className='flex w-56 flex-col gap-2'>
      <Spinner label={progress.step} />
      <progress className='h-1.5 w-full accent-primary' value={progress.value} max={1} aria-label='Repair progress' />
    </div>
  )

  if (!file || !model)
    return (
      <div className='flex flex-col gap-2'>
        <DropZone
          className='py-5'
          onFiles={(f) => void handleFile(f)}
          accept='.stl'
          hint='Binary or ASCII STL — repaired locally'
        >
          Drop an STL file here or click to browse
        </DropZone>
        {!ready && !error && <Spinner label='Loading mesh repair engine…' />}
        <Alert>{error}</Alert>
      </div>
    )

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' onClick={repair} disabled={!ready || !!progress}>
            <Wrench /> Repair
          </Button>
          <select
            aria-label='Preset'
            className={cn(fieldClass, 'h-7 w-auto py-0 pr-8 text-xs')}
            value={preset}
            onChange={(e) => {
              const p = e.target.value as PresetName
              setPreset(p)
              if (p !== 'custom') setOptions({ ...PRESETS[p] })
            }}
          >
            <option value='minimal'>Minimal</option>
            <option value='print-ready'>Print-ready</option>
            <option value='aggressive'>Aggressive</option>
            <option value='custom'>Custom</option>
          </select>
          {options.fillHoles && (
            <label className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              Max hole
              <Input
                type='number'
                className='h-7 w-20 text-xs'
                min={1}
                max={1000}
                value={options.maxHoleSize ?? 100}
                onChange={(e) => setOption('maxHoleSize', parseInt(e.target.value) || 100)}
              />
              edges
            </label>
          )}
          {repaired && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => downloadBlob(repaired.data, file.name.replace(/(\.stl)?$/i, '_repaired.stl'))}
            >
              <Download /> Download
            </Button>
          )}
          <Button size='sm' variant='ghost' onClick={clear}>
            <Trash2 /> Clear
          </Button>
          {!ready && !error && <Spinner label='Loading engine…' />}
          <span className='ml-auto flex min-w-0 items-center gap-2 text-xs text-muted-foreground'>
            <span className='truncate font-medium text-foreground' title={file.name}>
              {file.name}
            </span>
            {filesize(file.data.byteLength, { base: 2 })}
          </span>
        </>
      }
    >
      <div className='flex shrink-0 flex-wrap gap-x-4 gap-y-1'>
        {OPTION_LABELS.map(([key, title]) => (
          <Checkbox
            key={key}
            className='text-xs'
            title={title}
            checked={!!options[key]}
            onChange={(e) => setOption(key, e.target.checked)}
          />
        ))}
      </div>
      <Alert>{error}</Alert>
      <Split>
        <Viewer title='Original' geometry={model.geometry} model={model} camera={camera.current} isLeader />
        <div className='flex min-h-0 flex-col gap-2'>
          <div className='min-h-0 flex-1'>
            <Viewer
              title='Repaired'
              geometry={repairedGeometry}
              model={model}
              camera={camera.current}
              isLeader={false}
              busy={busy}
            />
          </div>
          {repaired && <RepairStats result={repaired.result} />}
        </div>
      </Split>
    </Workspace>
  )
}

export default STLRepair
