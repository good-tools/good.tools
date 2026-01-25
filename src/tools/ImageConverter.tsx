import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/Button'
import { XCircleIcon, ArrowDownTrayIcon, TrashIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { filesize } from 'filesize'
import type { ImageInfo, ResizeMode, ResizeOptions } from '@/workers/vips.worker'

type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif'

interface ConversionResult {
  buffer: ArrayBuffer
  format: OutputFormat
  size: number
}

function ImageConverter() {
  // File state
  const [fileName, setFileName] = useState<string | null>(null)
  const [originalBuffer, setOriginalBuffer] = useState<ArrayBuffer | null>(null)
  const [originalMimeType, setOriginalMimeType] = useState<string>('image/png')
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null)
  const [originalSize, setOriginalSize] = useState<number>(0)
  const [result, setResult] = useState<ConversionResult | null>(null)

  // UI state
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Initializing...')

  // Options
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('webp')
  const [quality, setQuality] = useState(80)

  // Resize options
  const [resizeMode, setResizeMode] = useState<ResizeMode>('none')
  const [resizePercentage, setResizePercentage] = useState(50)
  const [resizeWidth, setResizeWidth] = useState<number | ''>('')
  const [resizeHeight, setResizeHeight] = useState<number | ''>('')

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const resultPreviewRef = useRef<HTMLCanvasElement>(null)
  const requestIdRef = useRef(0)
  const workerRef = useRef<Worker | null>(null)

  // Render image to canvas
  const renderToCanvas = useCallback((canvas: HTMLCanvasElement | null, buffer: ArrayBuffer, mimeType: string) => {
    if (!canvas || buffer.byteLength === 0) return

    // Create a copy of the buffer to ensure it's not neutered
    const bufferCopy = buffer.slice(0)
    const blob = new Blob([bufferCopy], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const img = new window.Image()

    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Set canvas size to match image (max 400px)
      const maxSize = 400
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
    }

    img.onerror = () => {
      console.error('Failed to load image for preview:', mimeType, buffer.byteLength)
      URL.revokeObjectURL(url)
    }

    img.src = url
  }, [])

  // Store outputFormat in a ref so worker message handler can access current value
  const outputFormatRef = useRef(outputFormat)
  useEffect(() => {
    outputFormatRef.current = outputFormat
  }, [outputFormat])

  // Calculate preview dimensions based on resize settings
  const previewDimensions = useMemo(() => {
    if (!imageInfo) return null

    const { width, height } = imageInfo
    const aspectRatio = width / height

    switch (resizeMode) {
      case 'none':
        return { width, height }
      case 'percentage': {
        const scale = resizePercentage / 100
        return {
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        }
      }
      case 'width': {
        const targetWidth = resizeWidth || width
        return {
          width: targetWidth,
          height: Math.round(targetWidth / aspectRatio),
        }
      }
      case 'height': {
        const targetHeight = resizeHeight || height
        return {
          width: Math.round(targetHeight * aspectRatio),
          height: targetHeight,
        }
      }
      case 'dimensions':
        return {
          width: resizeWidth || width,
          height: resizeHeight || height,
        }
      default:
        return { width, height }
    }
  }, [imageInfo, resizeMode, resizePercentage, resizeWidth, resizeHeight])

  // Build resize options for the worker
  const buildResizeOptions = useCallback((): ResizeOptions | undefined => {
    if (resizeMode === 'none') return undefined

    return {
      mode: resizeMode,
      percentage: resizeMode === 'percentage' ? resizePercentage : undefined,
      width: resizeMode === 'width' || resizeMode === 'dimensions' ? resizeWidth || undefined : undefined,
      height: resizeMode === 'height' || resizeMode === 'dimensions' ? resizeHeight || undefined : undefined,
    }
  }, [resizeMode, resizePercentage, resizeWidth, resizeHeight])

  // Set up worker - create inside effect for React Strict Mode compatibility
  useEffect(() => {
    // Create worker inside effect so React Strict Mode re-creates it on double-invoke
    const worker = new Worker(new URL('../workers/vips.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onerror = (e) => console.error('Worker Load Error:', e)
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent) => {
      const {
        type,
        data,
        error: err,
        status: workerStatus,
      } = event.data as {
        type: string
        data?: ImageInfo | ArrayBuffer
        error?: string
        status?: string
      }

      if (type === 'init') {
        setLoading(false)
        setReady(true)
        setStatus('Ready')
      } else if (type === 'status') {
        setStatus(workerStatus || '')
      } else if (type === 'error') {
        setError(err || 'Unknown error')
        setLoading(false)
        setConverting(false)
      } else if (type === 'loaded') {
        setImageInfo(data as ImageInfo)
        // Auto-select format based on alpha
        if ((data as ImageInfo).hasAlpha) {
          setOutputFormat('png')
        } else {
          setOutputFormat('webp')
        }
      } else if (type === 'converted') {
        const buffer = data as ArrayBuffer
        const currentFormat = outputFormatRef.current
        setResult({
          buffer,
          format: currentFormat,
          size: buffer.byteLength,
        })
        setConverting(false)
      }
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  // Render original preview when buffer changes and canvas is mounted
  useEffect(() => {
    if (originalBuffer && previewRef.current) {
      renderToCanvas(previewRef.current, originalBuffer, originalMimeType)
    }
  }, [originalBuffer, originalMimeType, renderToCanvas])

  // Render result preview when result changes and canvas is mounted
  useEffect(() => {
    if (result && resultPreviewRef.current) {
      const mimeType = result.format === 'jpeg' ? 'image/jpeg' : `image/${result.format}`
      renderToCanvas(resultPreviewRef.current, result.buffer, mimeType)
    }
  }, [result, renderToCanvas])

  // Load file
  const handleFile = useCallback(
    async (file: File) => {
      if (!ready || !workerRef.current) return

      setError(null)
      setResult(null)
      setFileName(file.name)

      try {
        const buffer = await file.arrayBuffer()
        // Store a copy for later use
        const storedBuffer = buffer.slice(0)
        const mimeType = file.type || 'image/png'

        setOriginalBuffer(storedBuffer)
        setOriginalMimeType(mimeType)
        setOriginalSize(storedBuffer.byteLength)

        // Send a separate copy to worker to get image info
        const workerBuffer = buffer.slice(0)
        const id = ++requestIdRef.current
        workerRef.current.postMessage({ type: 'load', id, buffer: workerBuffer }, [workerBuffer])
      } catch (err) {
        setError(`Failed to load image: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [ready],
  )

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        void handleFile(file)
      } else {
        setError('Please drop a valid image file')
      }
    },
    [handleFile],
  )

  // Handle file input
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        void handleFile(file)
      }
    },
    [handleFile],
  )

  // Convert image
  const convert = useCallback(() => {
    if (!originalBuffer || !ready || !workerRef.current) return

    setConverting(true)
    setError(null)

    const id = ++requestIdRef.current
    // Send buffer copy to worker (original buffer can be neutered)
    const bufferCopy = originalBuffer.slice(0)
    const resizeOptions = buildResizeOptions()
    workerRef.current.postMessage(
      { type: 'convert', id, buffer: bufferCopy, format: outputFormat, options: { quality, resize: resizeOptions } },
      [bufferCopy],
    )
  }, [originalBuffer, outputFormat, quality, ready, buildResizeOptions])

  // Download result
  const download = useCallback(() => {
    if (!result || !fileName) return

    const mimeType = result.format === 'jpeg' ? 'image/jpeg' : `image/${result.format}`
    const blob = new Blob([result.buffer], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    // Replace extension
    const baseName = fileName.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}.${result.format}`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, fileName])

  // Clear
  const clear = useCallback(() => {
    setFileName(null)
    setOriginalBuffer(null)
    setOriginalMimeType('image/png')
    setImageInfo(null)
    setOriginalSize(0)
    setResult(null)
    setError(null)
    setResizeMode('none')
    setResizePercentage(50)
    setResizeWidth('')
    setResizeHeight('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (previewRef.current) {
      const ctx = previewRef.current.getContext('2d')
      ctx?.clearRect(0, 0, previewRef.current.width, previewRef.current.height)
    }
    if (resultPreviewRef.current) {
      const ctx = resultPreviewRef.current.getContext('2d')
      ctx?.clearRect(0, 0, resultPreviewRef.current.width, resultPreviewRef.current.height)
    }
  }, [])

  const sizeChange = result ? ((result.size - originalSize) / originalSize) * 100 : 0
  const sizeChangeText = sizeChange < 0 ? `${sizeChange.toFixed(1)}%` : `+${sizeChange.toFixed(1)}%`
  const sizeChangeColor = sizeChange < 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className='mt-5'>
      {/* Hidden file input */}
      <input ref={fileInputRef} type='file' accept='image/*' onChange={handleFileChange} className='hidden' />

      {/* Drop zone - show when loading or no file */}
      {!fileName && (
        <div
          onClick={() => ready && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            ready
              ? 'border-gray-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer'
              : 'border-gray-200 dark:border-zinc-800 cursor-wait'
          }`}
        >
          {loading ? (
            <div className='flex flex-col items-center gap-2 text-gray-500'>
              <svg className='animate-spin h-8 w-8' fill='none' viewBox='0 0 24 24'>
                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              <span className='text-sm'>{status}</span>
            </div>
          ) : (
            <>
              <div className='text-gray-400 dark:text-gray-500 mb-2'>
                <svg className='mx-auto h-12 w-12' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1}
                    d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                  />
                </svg>
              </div>
              <p className='text-gray-600 dark:text-gray-400'>Drop an image here, or click to select</p>
              <p className='text-xs text-gray-400 dark:text-gray-600 mt-1'>Supports JPEG, PNG, WebP, AVIF</p>
            </>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className='mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-4'>
          <div className='flex'>
            <XCircleIcon className='h-5 w-5 text-red-400' aria-hidden='true' />
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800 dark:text-red-400'>{error}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Options */}
      {originalBuffer && (
        <div className='mt-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-sm font-medium'>Conversion Options</h3>
            <div className='flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700'>
              <DocumentTextIcon className='h-3 w-3' />
              <span
                className='font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate'
                title={fileName ?? ''}
              >
                {fileName}
              </span>
              <span>•</span>
              <span>{filesize(originalSize, { base: 2 })}</span>
              {imageInfo && (
                <>
                  <span>•</span>
                  <span>
                    {imageInfo.width}×{imageInfo.height}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Format selector */}
          <div className='mb-4'>
            <label className='block text-sm font-medium mb-2'>Output Format</label>
            <div className='flex flex-wrap gap-2'>
              {(['jpeg', 'png', 'webp', 'avif'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setOutputFormat(fmt)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors uppercase font-medium ${
                    outputFormat === fmt
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Quality slider (for lossy formats) */}
          {(outputFormat === 'jpeg' || outputFormat === 'webp' || outputFormat === 'avif') && (
            <div className='mb-4'>
              <label className='block text-sm font-medium mb-2'>
                Quality: <span className='font-mono'>{quality}%</span>
              </label>
              <input
                type='range'
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className='w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600'
              />
              <div className='flex justify-between text-xs text-gray-400 mt-1'>
                <span>Smaller file</span>
                <span>Higher quality</span>
              </div>
            </div>
          )}

          {/* Resize options */}
          <div className='mb-4'>
            <label className='block text-sm font-medium mb-2'>Resize</label>
            <div className='flex flex-wrap gap-2 mb-3'>
              {[
                { mode: 'none' as const, label: 'None' },
                { mode: 'percentage' as const, label: '%' },
                { mode: 'width' as const, label: 'Width' },
                { mode: 'height' as const, label: 'Height' },
                { mode: 'dimensions' as const, label: 'Custom' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setResizeMode(mode)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                    resizeMode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Percentage slider */}
            {resizeMode === 'percentage' && (
              <div>
                <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>
                  Scale: <span className='font-mono'>{resizePercentage}%</span>
                </label>
                <input
                  type='range'
                  min={1}
                  max={200}
                  value={resizePercentage}
                  onChange={(e) => setResizePercentage(parseInt(e.target.value))}
                  className='w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600'
                />
                <div className='flex justify-between text-xs text-gray-400 mt-1'>
                  <span>1%</span>
                  <span>100%</span>
                  <span>200%</span>
                </div>
              </div>
            )}

            {/* Width input */}
            {resizeMode === 'width' && (
              <div>
                <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>Target Width (px)</label>
                <input
                  type='number'
                  min={1}
                  placeholder={imageInfo?.width.toString() || ''}
                  value={resizeWidth}
                  onChange={(e) => setResizeWidth(e.target.value ? parseInt(e.target.value) : '')}
                  className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                />
                <p className='text-xs text-gray-400 mt-1'>Height will be calculated to maintain aspect ratio</p>
              </div>
            )}

            {/* Height input */}
            {resizeMode === 'height' && (
              <div>
                <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>Target Height (px)</label>
                <input
                  type='number'
                  min={1}
                  placeholder={imageInfo?.height.toString() || ''}
                  value={resizeHeight}
                  onChange={(e) => setResizeHeight(e.target.value ? parseInt(e.target.value) : '')}
                  className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                />
                <p className='text-xs text-gray-400 mt-1'>Width will be calculated to maintain aspect ratio</p>
              </div>
            )}

            {/* Custom dimensions */}
            {resizeMode === 'dimensions' && (
              <div className='flex gap-3'>
                <div className='flex-1'>
                  <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>Width (px)</label>
                  <input
                    type='number'
                    min={1}
                    placeholder={imageInfo?.width.toString() || ''}
                    value={resizeWidth}
                    onChange={(e) => setResizeWidth(e.target.value ? parseInt(e.target.value) : '')}
                    className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                  />
                </div>
                <div className='flex items-end pb-2 text-gray-400'>×</div>
                <div className='flex-1'>
                  <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>Height (px)</label>
                  <input
                    type='number'
                    min={1}
                    placeholder={imageInfo?.height.toString() || ''}
                    value={resizeHeight}
                    onChange={(e) => setResizeHeight(e.target.value ? parseInt(e.target.value) : '')}
                    className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                  />
                </div>
              </div>
            )}

            {/* Preview dimensions */}
            {resizeMode !== 'none' && previewDimensions && imageInfo && (
              <div className='mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-900 px-2 py-1 rounded'>
                Output:{' '}
                <span className='font-mono'>
                  {previewDimensions.width}×{previewDimensions.height}
                </span>{' '}
                <span className='text-gray-400'>
                  (original: {imageInfo.width}×{imageInfo.height})
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className='flex items-center justify-between'>
            <div className='flex gap-2'>
              <Button onClick={convert} disabled={converting || !ready}>
                {converting ? (
                  <>
                    <svg className='animate-spin h-4 w-4 mr-2' viewBox='0 0 24 24' fill='none'>
                      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      />
                    </svg>
                    Converting...
                  </>
                ) : (
                  `Convert to ${outputFormat.toUpperCase()}`
                )}
              </Button>

              {result && (
                <Button variant='outline' onClick={download} className='items-center gap-2'>
                  <ArrowDownTrayIcon className='h-4 w-4' />
                  Download
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
        </div>
      )}

      {/* Previews */}
      {originalBuffer && (
        <div className='mt-4 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden'>
          <div className='flex'>
            {/* Original */}
            <div className='flex-1 flex flex-col min-w-0'>
              <div className='text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700'>
                Original
              </div>
              <div className='flex-1 bg-gray-50 dark:bg-zinc-900 flex items-center justify-center min-h-[300px] p-4'>
                <canvas ref={previewRef} className='max-w-full max-h-[300px] shadow-lg rounded' />
              </div>
              <div className='text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700'>
                {filesize(originalSize, { base: 2 })}
              </div>
            </div>

            <div className='w-px bg-gray-200 dark:bg-zinc-700' />

            {/* Result */}
            <div className='flex-1 flex flex-col min-w-0'>
              <div className='text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700'>
                Converted
              </div>
              <div className='flex-1 bg-gray-50 dark:bg-zinc-900 flex items-center justify-center min-h-[300px] p-4'>
                {result ? (
                  <canvas ref={resultPreviewRef} className='max-w-full max-h-[300px] shadow-lg rounded' />
                ) : (
                  <span className='text-gray-400 dark:text-gray-600'>Click Convert to see result</span>
                )}
              </div>
              <div className='text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700'>
                {result ? (
                  <span>
                    {filesize(result.size, { base: 2 })} <span className={sizeChangeColor}>({sizeChangeText})</span>
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageConverter
