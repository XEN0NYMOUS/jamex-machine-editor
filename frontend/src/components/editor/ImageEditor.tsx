import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Undo2, Paintbrush, Sliders, Droplet, Eraser, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../utils/cn'

type ToolMode = 'restore' | 'blur' | 'undo'

interface ImageEditorProps {
  originalUrl: string
  processedUrl: string
  filename: string
  onClose: () => void
  onSave?: (dataUrl: string) => void
  onNext?: () => void
  onPrev?: () => void
  hasNext?: boolean
  hasPrev?: boolean
  currentIndex?: number
  totalImages?: number
  initialTool?: ToolMode
}

const tools: { mode: ToolMode; icon: typeof Paintbrush; label: string }[] = [
  { mode: 'restore', icon: Paintbrush, label: 'Restore' },
  { mode: 'blur', icon: Droplet, label: 'Blur' },
  { mode: 'undo', icon: Eraser, label: 'Undo brush' },
]

export default function ImageEditor({
  originalUrl, processedUrl, filename, onClose,
  onSave, onNext, onPrev, hasNext, hasPrev, currentIndex, totalImages,
  initialTool,
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const savedBrushSize = useRef(() => {
    try { return parseInt(localStorage.getItem('jamex_brushSize') || '') || 30 } catch { return 30 }
  })

  const [brushSize, setBrushSize] = useState(savedBrushSize.current())
  const [isDrawing, setIsDrawing] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tool, setTool] = useState<ToolMode>(initialTool || 'restore')
  const [blurRadius, setBlurRadius] = useState(15)
  const [resetting, setResetting] = useState(false)

  const origImgRef = useRef<HTMLImageElement | null>(null)
  const procImgRef = useRef<HTMLImageElement | null>(null)
  const blurredRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const orig = new Image()
    const proc = new Image()
    let origLoaded = false
    let procLoaded = false
    let hasError = false
    if (!originalUrl.startsWith('data:')) orig.crossOrigin = 'anonymous'
    if (!processedUrl.startsWith('data:')) proc.crossOrigin = 'anonymous'

    function checkReady() {
      if (origLoaded && procLoaded) {
        origImgRef.current = orig
        procImgRef.current = proc
        initCanvas()
        setLoaded(true)
      }
    }

    function onOrigLoad() { origLoaded = true; checkReady() }
    function onProcLoad() { procLoaded = true; checkReady() }

    function onOrigError() {
      if (hasError) return
      hasError = true
      procLoaded = true; origLoaded = true
      origImgRef.current = proc.naturalWidth > 0 ? proc : orig
      procImgRef.current = proc
      initCanvas()
      setLoaded(true)
    }

    function onProcError() {
      if (hasError) return
      hasError = true
      origLoaded = true; procLoaded = true
      procImgRef.current = orig.naturalWidth > 0 ? orig : proc
      origImgRef.current = orig
      initCanvas()
      setLoaded(true)
    }

    orig.onload = onOrigLoad
    proc.onload = onProcLoad
    orig.onerror = onOrigError
    proc.onerror = onProcError
    orig.src = originalUrl
    proc.src = processedUrl

    if (orig.complete) origLoaded = true
    if (proc.complete) procLoaded = true
    checkReady()

    return () => {
      orig.onload = null
      proc.onload = null
      orig.onerror = null
      proc.onerror = null
    }
  }, [originalUrl, processedUrl])

  function initCanvas() {
    const canvas = canvasRef.current
    if (!canvas || !origImgRef.current || !procImgRef.current) return
    const w = procImgRef.current.naturalWidth
    const h = procImgRef.current.naturalHeight
    canvas.width = w
    canvas.height = h
    canvas.style.maxWidth = '100%'
    canvas.style.maxHeight = '85vh'

    const ctx = canvas.getContext('2d')!
    ctx.drawImage(procImgRef.current, 0, 0, w, h)
    saveState()
  }

  function saveState() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory(prev => [...prev.slice(-19), data])
  }

  function undo() {
    if (history.length < 2) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const prev = history[history.length - 2]
    ctx.putImageData(prev, 0, 0)
    setHistory(prev => prev.slice(0, -1))
  }

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    }
  }

  function getBlurredCanvas(): HTMLCanvasElement | null {
    if (!procImgRef.current || !canvasRef.current) return null
    if (blurredRef.current) return blurredRef.current
    try {
      const c = canvasRef.current
      const offscreen = document.createElement('canvas')
      offscreen.width = c.width
      offscreen.height = c.height
      const ctx = offscreen.getContext('2d')!
      ctx.filter = `blur(${blurRadius}px)`
      ctx.drawImage(procImgRef.current, 0, 0, c.width, c.height)
      ctx.filter = 'none'
      blurredRef.current = offscreen
      return offscreen
    } catch { return null }
  }

  function paintBlurRegion(pos: { x: number; y: number }) {
    const canvas = canvasRef.current
    if (!canvas || !procImgRef.current) return
    const ctx = canvas.getContext('2d')!
    const blurred = getBlurredCanvas()
    if (!blurred) return

    ctx.save()
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(blurred, 0, 0)
    ctx.restore()
  }

  function paintRegion(
    pos: { x: number; y: number },
    source: CanvasImageSource,
  ) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    ctx.save()
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2)
    ctx.clip()
    const sx = pos.x - brushSize
    const sy = pos.y - brushSize
    const sw = brushSize * 2
    const sh = brushSize * 2
    ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh)
    ctx.restore()
  }

  function paint(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !loaded) return
    const pos = getCanvasPos(e)

    if (tool === 'restore') {
      if (!origImgRef.current) return
      paintRegion(pos, origImgRef.current)
    } else if (tool === 'blur') {
      paintBlurRegion(pos)
    } else if (tool === 'undo') {
      if (!procImgRef.current) return
      paintRegion(pos, procImgRef.current)
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    saveState()
    blurredRef.current = null
    paint(e)
  }, [isDrawing, loaded, brushSize, tool, blurRadius])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    paint(e)
  }, [isDrawing, loaded, brushSize, tool, blurRadius])

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
  }, [])

  function getCanvasDataUrl(): string {
    return canvasRef.current?.toDataURL('image/png') || ''
  }

  function saveCurrent() {
    const dataUrl = getCanvasDataUrl()
    if (dataUrl && onSave) onSave(dataUrl)
  }

  function handleClose() {
    saveCurrent()
    onClose()
  }

  function handleNext() {
    saveCurrent()
    onNext?.()
  }

  function handlePrev() {
    saveCurrent()
    onPrev?.()
  }

  function downloadEdited() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `edited-${filename.replace(/\.[^.]+$/, '.png')}`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function resetAll() {
    if (!procImgRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(procImgRef.current, 0, 0, canvas.width, canvas.height)
    blurredRef.current = null
    saveState()
    setResetting(true)
    setTimeout(() => setResetting(false), 400)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault()
            setTool('blur')
            blurredRef.current = null
            break
          case 'q':
            e.preventDefault()
            resetAll()
            break
          case 'z':
            e.preventDefault()
            undo()
            break
          case 's':
            e.preventDefault()
            downloadEdited()
            break
        }
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (hasNext) handleNext()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (hasPrev) handlePrev()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    try { localStorage.setItem('jamex_brushSize', String(brushSize)) } catch {}
  }, [brushSize])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-full max-w-full flex-col rounded-lg bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            {onPrev && (
              <button
                onClick={handlePrev}
                disabled={!hasPrev}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                title="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <h3 className="text-sm font-semibold text-foreground">
              {filename}
              {totalImages !== undefined && currentIndex !== undefined && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {currentIndex + 1} / {totalImages}
                </span>
              )}
            </h3>
            {onNext && (
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                title="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={handleClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex-1 overflow-auto p-4">
          <AnimatePresence>
            {resetting && (
              <motion.div
                key="reset-flash"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-white"
              />
            )}
          </AnimatePresence>
          {!loaded && (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading images...
            </div>
          )}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`cursor-crosshair rounded-lg ${loaded ? '' : 'hidden'}`}
            style={{ touchAction: 'none' }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">

          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {tools.map((t) => (
              <button
                key={t.mode}
                onClick={() => { setTool(t.mode); blurredRef.current = null }}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  tool === t.mode
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <AnimatePresence>
              {tool === 'blur' && (
                <motion.div
                  key="blur-controls"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-3"
                >
                  <Sliders className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="range"
                    min={3}
                    max={50}
                    value={blurRadius}
                    onChange={(e) => { setBlurRadius(Number(e.target.value)); blurredRef.current = null }}
                    className="w-20 accent-primary"
                  />
                  <span className="w-8 text-xs text-muted-foreground">{blurRadius}px</span>
                </motion.div>
              )}
            </AnimatePresence>
            <Sliders className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min={5}
              max={150}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="w-8 text-xs text-muted-foreground">{brushSize}px</span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={undo} disabled={history.length < 2} title="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={resetAll} title="Reset all edits">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={downloadEdited} className="gap-1.5">
              <Download className="h-4 w-4" />
              Export PNG
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
