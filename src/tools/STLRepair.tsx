import { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { MeshRepair, PRESETS, type RepairOptions, type RepairResult } from '@goodtools/meshrepair'
// @ts-expect-error - No type declarations for WASM loader subpath export
import loadMeshRepair from '@goodtools/meshrepair/dist/meshrepair.js'
// Import WASM file as URL asset (like wiregasm pattern)
import wasmPath from '@goodtools/meshrepair/dist/meshrepair.wasm?url'
import { Button } from '@/components/Button'
import { XCircleIcon, ArrowDownTrayIcon, TrashIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

// Preset type
type PresetName = 'minimal' | 'print-ready' | 'aggressive' | 'custom'

// Shared camera state for syncing viewers
interface CameraState {
  position: THREE.Vector3
  target: THREE.Vector3
}

// Component to sync camera state to external ref
function CameraSync({
  cameraStateRef,
  isLeader,
}: {
  cameraStateRef: React.MutableRefObject<CameraState>
  isLeader: boolean
}) {
  const { camera } = useThree()
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void } | null>(null)

  useFrame(() => {
    if (isLeader && controlsRef.current) {
      // Leader: copy camera state to shared ref
      cameraStateRef.current.position.copy(camera.position)
      cameraStateRef.current.target.copy(controlsRef.current.target)
    } else if (!isLeader && controlsRef.current) {
      // Follower: copy shared ref to camera state
      camera.position.copy(cameraStateRef.current.position)
      controlsRef.current.target.copy(cameraStateRef.current.target)
      // Force controls to update
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef as React.Ref<never>}
      enableDamping={false}
      enabled={isLeader}
      makeDefault={isLeader}
    />
  )
}

// STL Mesh display component - manually centers using provided offset for consistent alignment
function STLMesh({
  geometry,
  centerOffset,
}: {
  geometry: THREE.BufferGeometry | null
  centerOffset: THREE.Vector3 | null
}) {
  if (!geometry) return null

  // If we have a center offset, use it; otherwise compute from this geometry
  const offset =
    centerOffset ??
    (() => {
      geometry.computeBoundingBox()
      const center = new THREE.Vector3()
      geometry.boundingBox?.getCenter(center)
      return center.negate()
    })()

  return (
    <group position={[offset.x, offset.y, offset.z]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color='#6366f1' flatShading />
      </mesh>
    </group>
  )
}

// 3D Viewer component
function Viewer({
  geometry,
  label,
  cameraStateRef,
  isLeader,
  centerOffset,
  loading,
}: {
  geometry: THREE.BufferGeometry | null
  label: string
  cameraStateRef: React.MutableRefObject<CameraState>
  isLeader: boolean
  centerOffset: THREE.Vector3 | null
  loading?: boolean
}) {
  return (
    <div className='flex-1 flex flex-col min-w-0'>
      <div className='text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700'>
        {label}
      </div>
      <div className='flex-1 bg-gray-50 dark:bg-zinc-900 relative min-h-[300px]'>
        {loading ? (
          <div className='absolute inset-0 flex flex-col items-center justify-center text-gray-500'>
            <svg
              aria-hidden='true'
              className='w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-indigo-600'
              viewBox='0 0 100 101'
              fill='none'
            >
              <path
                d='M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z'
                fill='currentColor'
              />
              <path
                d='M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z'
                fill='currentFill'
              />
            </svg>
            <span className='mt-2 text-sm font-medium'>Processing Mesh...</span>
          </div>
        ) : geometry ? (
          <Canvas camera={{ position: [0, 0, 100], fov: 50, near: 0.1, far: 10000 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} />
            <directionalLight position={[-10, -10, -10]} intensity={0.3} />
            <STLMesh geometry={geometry} centerOffset={centerOffset} />
            <CameraSync cameraStateRef={cameraStateRef} isLeader={isLeader} />
          </Canvas>
        ) : (
          <div className='absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600'>
            No model loaded
          </div>
        )}
      </div>
    </div>
  )
}

// Statistics display
function Stats({ label, geometry }: { label: string; geometry: THREE.BufferGeometry | null }) {
  if (!geometry) return null

  const position = geometry.getAttribute('position')
  const vertexCount = position ? position.count : 0
  const faceCount = Math.floor(vertexCount / 3)

  return (
    <div className='text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-zinc-800'>
      <span className='font-medium'>{label}:</span> {faceCount.toLocaleString()} faces, {vertexCount.toLocaleString()}{' '}
      vertices
    </div>
  )
}

// Repair result display
function RepairStats({ result }: { result: RepairResult | null }) {
  if (!result) return null

  const stats = [
    { label: 'Duplicate vertices removed', value: result.duplicateVerticesRemoved },
    { label: 'Duplicate faces removed', value: result.duplicateFacesRemoved },
    { label: 'Unreferenced vertices removed', value: result.unreferencedVerticesRemoved },
    { label: 'Degenerate faces removed', value: result.degenerateFacesRemoved },
    { label: 'Non-manifold faces removed', value: result.nonManifoldFacesRemoved },
    { label: 'Non-manifold vertices removed', value: result.nonManifoldVerticesRemoved },
    { label: 'Holes filled', value: result.holesFilled },
  ].filter((s) => s.value > 0)

  if (stats.length === 0) {
    return (
      <div className='mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
        <p className='text-green-700 dark:text-green-400 text-sm'>✓ Mesh is already clean! No repairs were needed.</p>
      </div>
    )
  }

  return (
    <div className='mt-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700'>
      <div className='flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-zinc-700'>
        <div className='h-5 w-5 bg-green-500 rounded-full flex items-center justify-center'>
          <svg className='w-3 h-3 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M5 13l4 4L19 7'></path>
          </svg>
        </div>
        <h4 className='text-sm font-bold text-green-700 dark:text-green-400'>Repair Complete!</h4>
      </div>
      <h4 className='text-sm font-medium mb-2'>Repair Statistics</h4>
      <div className='grid grid-cols-2 gap-2 text-sm'>
        {stats.map((stat) => (
          <div key={stat.label} className='flex justify-between'>
            <span className='text-gray-600 dark:text-gray-400'>{stat.label}:</span>
            <span className='font-mono'>{stat.value}</span>
          </div>
        ))}
      </div>
      <div className='mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700 text-sm'>
        <div className='flex justify-between'>
          <span>Original:</span>
          <span className='font-mono'>
            {result.originalFaces.toLocaleString()} faces, {result.originalVertices.toLocaleString()} vertices
          </span>
        </div>
        <div className='flex justify-between'>
          <span>Repaired:</span>
          <span className='font-mono'>
            {result.finalFaces.toLocaleString()} faces, {result.finalVertices.toLocaleString()} vertices
          </span>
        </div>
      </div>
    </div>
  )
}

function STLRepair() {
  // File state
  const [fileName, setFileName] = useState<string | null>(null)
  const [originalBuffer, setOriginalBuffer] = useState<Uint8Array | null>(null)
  const [repairedBuffer, setRepairedBuffer] = useState<Uint8Array | null>(null)

  // Geometry state
  const [originalGeometry, setOriginalGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [repairedGeometry, setRepairedGeometry] = useState<THREE.BufferGeometry | null>(null)
  // Center offset computed from original geometry - used to align both viewers
  const [centerOffset, setCenterOffset] = useState<THREE.Vector3 | null>(null)

  // Repair state
  const [meshRepair, setMeshRepair] = useState<MeshRepair | null>(null)
  const [loading, setLoading] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [progress, setProgress] = useState<{ step: string; value: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null)

  // Options state
  const [preset, setPreset] = useState<PresetName>('print-ready')
  const [options, setOptions] = useState<RepairOptions>({ ...PRESETS['print-ready'] })

  // Camera sync
  const cameraStateRef = useRef<CameraState>({
    position: new THREE.Vector3(0, 0, 100),
    target: new THREE.Vector3(0, 0, 0),
  })

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize MeshRepair
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        setLoading(true)
        const instance = await MeshRepair.init(loadMeshRepair as never, {
          // Use locateFile to point to the correct WASM path (imported as URL asset)
          locateFile: (path: string) => {
            if (path.endsWith('.wasm')) {
              return wasmPath
            }
            return path
          },
        })
        if (!cancelled) {
          setMeshRepair(instance)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to initialize MeshRepair: ${err instanceof Error ? err.message : String(err)}`)
          setLoading(false)
        }
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [])

  // Parse STL buffer to geometry
  const parseSTL = useCallback((buffer: ArrayBuffer): THREE.BufferGeometry => {
    const loader = new STLLoader()
    return loader.parse(buffer)
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      setRepairResult(null)
      setRepairedBuffer(null)
      setRepairedGeometry(null)
      setFileName(file.name)

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const buffer = new Uint8Array(e.target?.result as ArrayBuffer)
          setOriginalBuffer(buffer)
          const geometry = parseSTL(buffer.buffer)
          setOriginalGeometry(geometry)

          // Compute center offset from original geometry for consistent alignment
          geometry.computeBoundingBox()
          const center = new THREE.Vector3()
          geometry.boundingBox?.getCenter(center)
          setCenterOffset(center.negate())
        } catch (err) {
          setError(`Failed to parse STL: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      reader.readAsArrayBuffer(file)
    },
    [parseSTL],
  )

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.name.toLowerCase().endsWith('.stl')) {
        handleFile(file)
      } else {
        setError('Please drop a valid STL file')
      }
    },
    [handleFile],
  )

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile],
  )

  // Handle preset change
  const handlePresetChange = useCallback((newPreset: PresetName) => {
    setPreset(newPreset)
    if (newPreset !== 'custom') {
      setOptions({ ...PRESETS[newPreset] })
    }
  }, [])

  // Handle option change
  const handleOptionChange = useCallback((key: keyof RepairOptions, value: boolean | number) => {
    setPreset('custom')
    setOptions((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Repair the mesh
  const repair = useCallback(() => {
    if (!meshRepair || !originalBuffer || !fileName) return

    setRepairing(true)
    setError(null)
    setProgress({ step: 'Starting...', value: 0 })

    // Wrap in setTimeout to allow UI to render the loading state before the blocking WASM call
    setTimeout(() => {
      try {
        const { result, output } = meshRepair.repair(fileName, originalBuffer, options, (step, value) => {
          // Note: Since repair is synchronous, these updates won't render until after repair completes
          // unless the browser finds a chance to paint (unlikely during blocking WASM).
          // But we track it anyway.
          setProgress({ step, value })
        })

        if (result.code !== 0) {
          throw new Error(result.error || 'Repair failed')
        }

        setRepairedBuffer(output)
        setRepairResult(result)

        const geometry = parseSTL(output.buffer.slice(0) as ArrayBuffer)
        setRepairedGeometry(geometry)
      } catch (err) {
        setError(`Repair failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setRepairing(false)
        setProgress(null)
      }
    }, 100)
  }, [meshRepair, originalBuffer, fileName, options, parseSTL])

  // Download repaired file
  const download = useCallback(() => {
    if (!repairedBuffer || !fileName) return

    const blob = new Blob([repairedBuffer.slice()], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace(/\.stl$/i, '_repaired.stl')
    a.click()
    URL.revokeObjectURL(url)
  }, [repairedBuffer, fileName])

  // Clear everything
  const clear = useCallback(() => {
    setFileName(null)
    setOriginalBuffer(null)
    setRepairedBuffer(null)
    setOriginalGeometry(null)
    setRepairedGeometry(null)
    setCenterOffset(null)
    setRepairResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <div className='mt-5'>
      {/* File Upload */}
      {/* Hidden input for file selection - always present */}
      <input ref={fileInputRef} type='file' accept='.stl' onChange={handleFileChange} className='hidden' />

      {!fileName && (
        /* File Upload */
        <div
          className='border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors'
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {loading ? (
            <div className='flex flex-col items-center gap-3 text-gray-500'>
              <svg
                className='animate-spin h-8 w-8 text-indigo-500'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              <p>Initializing MeshRepair...</p>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-2'>
              <ArrowDownTrayIcon className='h-8 w-8 text-gray-400' />
              <p className='text-gray-500 dark:text-gray-400'>Drop an STL file here, or click to select</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className='rounded-md bg-red-50 dark:bg-red-900/20 p-4 mt-4'>
          <div className='flex'>
            <XCircleIcon className='h-5 w-5 text-red-400' aria-hidden='true' />
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800 dark:text-red-400'>{error}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Repair Options */}
      {originalBuffer && (
        <div className='mt-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-sm font-medium'>Repair Options</h3>
            <div className='flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700'>
              <DocumentTextIcon className='h-3 w-3' />
              <span
                className='font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate'
                title={fileName ?? ''}
              >
                {fileName}
              </span>
              <span>•</span>
              <span>{(originalBuffer.length / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>

          {/* Preset selector */}
          <div className='flex flex-wrap gap-2 mb-4'>
            {(['minimal', 'print-ready', 'aggressive', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  preset === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Options grid */}
          <div className='grid grid-cols-2 md:grid-cols-3 gap-3 text-sm'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={options.fillHoles ?? false}
                onChange={(e) => handleOptionChange('fillHoles', e.target.checked)}
                className='rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500'
              />
              Fill Holes
            </label>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={options.fixNormalOrientation ?? false}
                onChange={(e) => handleOptionChange('fixNormalOrientation', e.target.checked)}
                className='rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500'
              />
              Fix Normal Orientation
            </label>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={options.flipNormalsOutside ?? false}
                onChange={(e) => handleOptionChange('flipNormalsOutside', e.target.checked)}
                className='rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500'
              />
              Flip Normals Outside
            </label>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={options.removeNonManifoldFace ?? false}
                onChange={(e) => handleOptionChange('removeNonManifoldFace', e.target.checked)}
                className='rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500'
              />
              Remove Non-manifold Faces
            </label>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={options.removeNonManifoldVertex ?? false}
                onChange={(e) => handleOptionChange('removeNonManifoldVertex', e.target.checked)}
                className='rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500'
              />
              Remove Non-manifold Vertices
            </label>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={options.removeTVertexByFlip ?? false}
                onChange={(e) => handleOptionChange('removeTVertexByFlip', e.target.checked)}
                className='rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500'
              />
              Remove T-Vertices
            </label>
          </div>

          {/* Max hole size */}
          {options.fillHoles && (
            <div className='mt-3 flex items-center gap-2'>
              <label className='text-sm'>Max Hole Size (edges):</label>
              <input
                type='number'
                value={options.maxHoleSize ?? 100}
                onChange={(e) => handleOptionChange('maxHoleSize', parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
                className='w-24 px-2 py-1 text-sm rounded border border-gray-300 dark:border-zinc-600 dark:bg-zinc-700'
              />
            </div>
          )}

          {/* Binary output toggle */}
          <label className='flex items-center gap-2 mt-3 cursor-pointer text-sm'>
            <input
              type='checkbox'
              checked={options.binaryOutput ?? true}
              onChange={(e) => handleOptionChange('binaryOutput', e.target.checked)}
              className='rounded border-gray-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500'
            />
            Binary Output (smaller file)
          </label>
        </div>
      )}

      {/* Repair Button */}
      {/* Repair Button and Actions */}
      {originalBuffer && (
        <div className='mt-4 flex items-center justify-between gap-4'>
          <div className='flex items-center gap-4 flex-1'>
            <Button
              variant='filled'
              onClick={() => void repair()}
              disabled={!meshRepair || repairing}
              className='items-center'
            >
              {repairing ? (
                <>
                  Repairing...
                  <svg aria-hidden='true' className='ml-2 w-4 h-4 animate-spin' viewBox='0 0 100 101' fill='none'>
                    <path
                      d='M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z'
                      fill='currentColor'
                      opacity='0.25'
                    />
                    <path
                      d='M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z'
                      fill='currentFill'
                    />
                  </svg>
                </>
              ) : (
                'Repair STL'
              )}
            </Button>

            {progress && (
              <div className='flex-1 max-w-xs'>
                <div className='text-xs text-gray-500 dark:text-gray-400 mb-1'>{progress.step}</div>
                <div className='w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2'>
                  <div
                    className='bg-indigo-600 h-2 rounded-full transition-all'
                    style={{ width: `${Math.round(progress.value * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {repairedBuffer && (
              <Button variant='outline' onClick={download} className='items-center gap-2'>
                <ArrowDownTrayIcon className='h-4 w-4' />
                Download Repaired STL
              </Button>
            )}
          </div>

          <Button
            variant='text'
            onClick={clear}
            className='text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          >
            <TrashIcon className='h-4 w-4 mr-2' />
            Clear
          </Button>
        </div>
      )}

      {/* Dual Viewer */}
      {originalGeometry && (
        <div className='mt-4 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden'>
          <div className='flex h-[400px]'>
            <Viewer
              geometry={originalGeometry}
              label='Original'
              cameraStateRef={cameraStateRef}
              isLeader={true}
              centerOffset={centerOffset}
            />
            <div className='w-px bg-gray-200 dark:bg-zinc-700' />
            <Viewer
              geometry={repairedGeometry}
              label='Repaired'
              cameraStateRef={cameraStateRef}
              isLeader={false}
              centerOffset={centerOffset}
              loading={repairing}
            />
          </div>
          <div className='flex border-t border-gray-200 dark:border-zinc-700'>
            <Stats label='Original' geometry={originalGeometry} />
            <div className='w-px bg-gray-200 dark:bg-zinc-700' />
            <Stats label='Repaired' geometry={repairedGeometry} />
          </div>
        </div>
      )}

      {/* Repair Statistics */}
      <RepairStats result={repairResult} />
    </div>
  )
}

export default STLRepair
