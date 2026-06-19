import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { EdgeDetector } from '@/wasm/edgeDetector'

type DragMode = 'none' | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

interface DisplayRect {
  x: number
  y: number
  width: number
  height: number
}

export default function CanvasViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const edgeDetectorRef = useRef<EdgeDetector | null>(null)

  const originalImage = useAppStore((s) => s.originalImage)
  const originalImageData = useAppStore((s) => s.originalImageData)
  const edgeRgba = useAppStore((s) => s.edgeRgba)
  const cropRect = useAppStore((s) => s.cropRect)
  const showEdges = useAppStore((s) => s.showEdges)
  const sensitivity = useAppStore((s) => s.sensitivity)
  const detectTrigger = useAppStore((s) => s.detectTrigger)
  const status = useAppStore((s) => s.status)

  const setEdgeResult = useAppStore((s) => s.setEdgeResult)
  const setCropRect = useAppStore((s) => s.setCropRect)
  const setStatus = useAppStore((s) => s.setStatus)
  const setError = useAppStore((s) => s.setError)

  const [displayScale, setDisplayScale] = useState(1)
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const [dragMode, setDragMode] = useState<DragMode>('none')
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragStartRect, setDragStartRect] = useState<DisplayRect | null>(null)
  const [hoverMode, setHoverMode] = useState<DragMode>('none')

  const toDisplayRect = (rect: DisplayRect): DisplayRect => ({
    x: rect.x * displayScale + imageOffset.x,
    y: rect.y * displayScale + imageOffset.y,
    width: rect.width * displayScale,
    height: rect.height * displayScale,
  })

  const toImageCoord = (displayX: number, displayY: number) => ({
    x: (displayX - imageOffset.x) / displayScale,
    y: (displayY - imageOffset.y) / displayScale,
  })

  const getHandleAtPoint = (displayX: number, displayY: number): DragMode => {
    if (!cropRect) return 'none'
    const d = toDisplayRect(cropRect)
    const handleSize = 16

    const handles: [DragMode, number, number][] = [
      ['nw', d.x, d.y],
      ['ne', d.x + d.width, d.y],
      ['sw', d.x, d.y + d.height],
      ['se', d.x + d.width, d.y + d.height],
      ['n', d.x + d.width / 2, d.y],
      ['s', d.x + d.width / 2, d.y + d.height],
      ['w', d.x, d.y + d.height / 2],
      ['e', d.x + d.width, d.y + d.height / 2],
    ]

    for (const [mode, hx, hy] of handles) {
      if (Math.abs(displayX - hx) < handleSize && Math.abs(displayY - hy) < handleSize) {
        return mode
      }
    }

    if (
      displayX >= d.x &&
      displayX <= d.x + d.width &&
      displayY >= d.y &&
      displayY <= d.y + d.height
    ) {
      return 'move'
    }

    return 'none'
  }

  useEffect(() => {
    if (!originalImage || !containerRef.current) return

    const container = containerRef.current
    const containerW = container.clientWidth
    const containerH = container.clientHeight
    const imgW = originalImage.width
    const imgH = originalImage.height

    const scale = Math.min(containerW / imgW, containerH / imgH, 1)
    const displayW = imgW * scale
    const displayH = imgH * scale
    const offsetX = (containerW - displayW) / 2
    const offsetY = (containerH - displayH) / 2

    setDisplayScale(scale)
    setImageOffset({ x: offsetX, y: offsetY })
  }, [originalImage])

  useEffect(() => {
    if (!originalImageData) return

    if (!edgeDetectorRef.current) {
      edgeDetectorRef.current = new EdgeDetector()
    }

    setStatus('detecting')
    const threshold = Math.round(sensitivity * 2.55)

    edgeDetectorRef.current
      .detect(originalImageData, threshold)
      .then((result) => {
        setEdgeResult(result.edgeRgba)
      })
      .catch((err) => {
        setError('边缘检测失败: ' + err.message)
      })
  }, [originalImageData, sensitivity, detectTrigger])

  useEffect(() => {
    if (!edgeRgba || !originalImage || cropRect) return

    const w = originalImage.width
    const h = originalImage.height
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0
    let foundEdge = false

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        if (edgeRgba[idx + 3] > 0) {
          foundEdge = true
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (!foundEdge) {
      const margin = 0.1
      setCropRect({
        x: Math.round(w * margin),
        y: Math.round(h * margin),
        width: Math.round(w * (1 - 2 * margin)),
        height: Math.round(h * (1 - 2 * margin)),
      })
    } else {
      const padX = Math.round((maxX - minX) * 0.1)
      const padY = Math.round((maxY - minY) * 0.1)
      setCropRect({
        x: Math.max(0, minX - padX),
        y: Math.max(0, minY - padY),
        width: Math.min(w - Math.max(0, minX - padX), maxX - minX + padX * 2),
        height: Math.min(h - Math.max(0, minY - padY), maxY - minY + padY * 2),
      })
    }
  }, [edgeRgba, originalImage])

  useEffect(() => {
    return () => {
      edgeDetectorRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !originalImage) return

    const ctx = canvas.getContext('2d')!
    const container = containerRef.current!
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight

    ctx.fillStyle = '#0D0D0D'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const displayW = originalImage.width * displayScale
    const displayH = originalImage.height * displayScale
    ctx.drawImage(originalImage, imageOffset.x, imageOffset.y, displayW, displayH)

    if (showEdges && edgeRgba && originalImageData) {
      const edgeCanvas = document.createElement('canvas')
      edgeCanvas.width = originalImageData.width
      edgeCanvas.height = originalImageData.height
      const edgeCtx = edgeCanvas.getContext('2d')!
      const edgeImageData = new ImageData(
        new Uint8ClampedArray(edgeRgba),
        originalImageData.width,
        originalImageData.height,
      )
      edgeCtx.putImageData(edgeImageData, 0, 0)
      ctx.drawImage(edgeCanvas, imageOffset.x, imageOffset.y, displayW, displayH)
    }

    if (cropRect) {
      const displayCrop = toDisplayRect(cropRect)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(imageOffset.x, imageOffset.y, displayW, displayCrop.y - imageOffset.y)
      ctx.fillRect(
        imageOffset.x,
        displayCrop.y + displayCrop.height,
        displayW,
        imageOffset.y + displayH - (displayCrop.y + displayCrop.height),
      )
      ctx.fillRect(
        imageOffset.x,
        displayCrop.y,
        displayCrop.x - imageOffset.x,
        displayCrop.height,
      )
      ctx.fillRect(
        displayCrop.x + displayCrop.width,
        displayCrop.y,
        imageOffset.x + displayW - (displayCrop.x + displayCrop.width),
        displayCrop.height,
      )

      ctx.strokeStyle = '#00E5CC'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 4])
      ctx.strokeRect(displayCrop.x, displayCrop.y, displayCrop.width, displayCrop.height)
      ctx.setLineDash([])

      ctx.strokeStyle = 'rgba(0, 229, 204, 0.2)'
      ctx.lineWidth = 1
      const thirdW = displayCrop.width / 3
      const thirdH = displayCrop.height / 3
      for (let i = 1; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(displayCrop.x + thirdW * i, displayCrop.y)
        ctx.lineTo(displayCrop.x + thirdW * i, displayCrop.y + displayCrop.height)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(displayCrop.x, displayCrop.y + thirdH * i)
        ctx.lineTo(displayCrop.x + displayCrop.width, displayCrop.y + thirdH * i)
        ctx.stroke()
      }
    }
  }, [originalImage, edgeRgba, cropRect, showEdges, displayScale, imageOffset])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!cropRect || status === 'detecting' || status === 'matting') return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const displayX = e.clientX - rect.left
      const displayY = e.clientY - rect.top
      const mode = getHandleAtPoint(displayX, displayY)

      if (mode !== 'none') {
        setDragMode(mode)
        setDragStart({ x: displayX, y: displayY })
        setDragStartRect({ ...cropRect })
        e.preventDefault()
      }
    },
    [cropRect, status],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!cropRect || !dragStartRect) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const displayX = e.clientX - rect.left
      const displayY = e.clientY - rect.top
      const dx = (displayX - dragStart.x) / displayScale
      const dy = (displayY - dragStart.y) / displayScale

      if (dragMode === 'move') {
        const newX = Math.max(
          0,
          Math.min(originalImage!.width - dragStartRect.width, dragStartRect.x + dx),
        )
        const newY = Math.max(
          0,
          Math.min(originalImage!.height - dragStartRect.height, dragStartRect.y + dy),
        )
        setCropRect({ ...dragStartRect, x: newX, y: newY })
      } else {
        let { x, y, width, height } = dragStartRect
        const minSize = 30

        if (dragMode.includes('w')) {
          const newX = Math.max(0, x + dx)
          width = width - (newX - x)
          x = newX
        }
        if (dragMode.includes('e')) {
          width = Math.max(minSize, Math.min(originalImage!.width - x, width + dx))
        }
        if (dragMode.includes('n')) {
          const newY = Math.max(0, y + dy)
          height = height - (newY - y)
          y = newY
        }
        if (dragMode.includes('s')) {
          height = Math.max(minSize, Math.min(originalImage!.height - y, height + dy))
        }

        if (width >= minSize && height >= minSize) {
          setCropRect({ x, y, width, height })
        }
      }
    },
    [cropRect, dragMode, dragStart, dragStartRect, displayScale, originalImage],
  )

  const handleMouseUp = useCallback(() => {
    setDragMode('none')
  }, [])

  const getCursor = (mode: DragMode): string => {
    const cursors: Record<DragMode, string> = {
      none: 'default',
      move: 'move',
      nw: 'nw-resize',
      ne: 'ne-resize',
      sw: 'sw-resize',
      se: 'se-resize',
      n: 'n-resize',
      s: 's-resize',
      w: 'w-resize',
      e: 'e-resize',
    }
    return cursors[mode]
  }

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (dragMode !== 'none') return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const displayX = e.clientX - rect.left
      const displayY = e.clientY - rect.top
      setHoverMode(getHandleAtPoint(displayX, displayY))
    },
    [dragMode, cropRect],
  )

  if (!originalImage) return null

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: getCursor(dragMode !== 'none' ? dragMode : hoverMode) }}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e)
          handleMouseOver(e)
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {status === 'detecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-brand-bg/60">
          <div className="flex items-center gap-3 text-brand-accent">
            <div className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
            <span className="font-display text-lg">正在检测边缘...</span>
          </div>
        </div>
      )}
    </div>
  )
}
