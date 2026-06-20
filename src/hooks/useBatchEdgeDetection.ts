import { useEffect, useRef } from 'react'
import { useBatchStore } from '@/store/useBatchStore'
import { EdgeDetector } from '@/wasm/edgeDetector'

const MAX_CONCURRENT_DETECTIONS = 2

function generateCropSuggestion(
  edgeRgba: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let foundEdge = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
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
    return {
      x: Math.round(width * margin),
      y: Math.round(height * margin),
      width: Math.round(width * (1 - 2 * margin)),
      height: Math.round(height * (1 - 2 * margin)),
    }
  }

  const padX = Math.round((maxX - minX) * 0.1)
  const padY = Math.round((maxY - minY) * 0.1)

  const x = Math.max(0, minX - padX)
  const y = Math.max(0, minY - padY)
  const w = Math.min(width - x, maxX - minX + padX * 2)
  const h = Math.min(height - y, maxY - minY + padY * 2)

  return { x, y, width: w, height: h }
}

export function useBatchEdgeDetection() {
  const detectorRef = useRef<EdgeDetector | null>(null)
  const processingRef = useRef<Set<string>>(new Set())

  const images = useBatchStore((s) => s.images)

  useEffect(() => {
    if (!detectorRef.current) {
      detectorRef.current = new EdgeDetector()
    }

    const processNext = () => {
      const state = useBatchStore.getState()
      const detectingImages = state.images.filter(
        (img) =>
          img.status === 'detecting' &&
          img.originalImageData &&
          !processingRef.current.has(img.id),
      )

      const availableSlots = MAX_CONCURRENT_DETECTIONS - processingRef.current.size
      const toProcess = detectingImages.slice(0, availableSlots)

      for (const img of toProcess) {
        if (!img.originalImageData) continue

        processingRef.current.add(img.id)

        const threshold = Math.round(img.sensitivity * 2.55)
        const imageId = img.id
        const imgW = img.originalImageData.width
        const imgH = img.originalImageData.height

        detectorRef.current!
          .detect(img.originalImageData, threshold)
          .then((result) => {
            const cropRect = generateCropSuggestion(result.edgeRgba, imgW, imgH)
            const state = useBatchStore.getState()
            const targetImg = state.images.find((i) => i.id === imageId)
            if (!targetImg || targetImg.status !== 'detecting') return

            useBatchStore.setState((prev) => ({
              images: prev.images.map((i) =>
                i.id === imageId
                  ? { ...i, edgeRgba: result.edgeRgba, cropRect, status: 'adjusting' as const }
                  : i,
              ),
            }))
          })
          .catch((err) => {
            useBatchStore.setState((prev) => ({
              images: prev.images.map((i) =>
                i.id === imageId
                  ? {
                      ...i,
                      status: 'error' as const,
                      errorMessage: '边缘检测失败: ' + (err.message || '未知错误'),
                    }
                  : i,
              ),
            }))
          })
          .finally(() => {
            processingRef.current.delete(imageId)
            setTimeout(processNext, 0)
          })
      }
    }

    processNext()
  }, [images])

  useEffect(() => {
    return () => {
      detectorRef.current?.destroy()
      detectorRef.current = null
      processingRef.current.clear()
    }
  }, [])
}
