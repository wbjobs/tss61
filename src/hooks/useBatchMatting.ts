import { useEffect, useRef, useCallback } from 'react'
import { useBatchStore } from '@/store/useBatchStore'

const MAX_CONCURRENCY = 4

const validatePng = (buffer: Uint8Array): boolean => {
  if (buffer.length < 12) return false
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false
  }
  const iendSig = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]
  const end = buffer.slice(buffer.length - 8, buffer.length)
  for (let i = 0; i < iendSig.length; i++) {
    if (end[i] !== iendSig[i]) return false
  }
  return true
}

const getCroppedPngBytes = async (
  imageElement: HTMLImageElement,
  cropRect: { x: number; y: number; width: number; height: number }
): Promise<Uint8Array> => {
  const maxAttempts = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(cropRect.width))
      canvas.height = Math.max(1, Math.round(cropRect.height))
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(
        imageElement,
        cropRect.x, cropRect.y, cropRect.width, cropRect.height,
        0, 0, canvas.width, canvas.height,
      )

      const dataUrl = canvas.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      if (bytes.length < 100) {
        throw new Error(`PNG 编码失败 (${bytes.length} bytes)`)
      }
      if (!validatePng(bytes)) {
        throw new Error('PNG 完整性校验失败')
      }

      return bytes
    } catch (e) {
      lastError = e as Error
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 100 * attempt))
      }
    }
  }

  throw lastError || new Error('PNG 编码失败')
}

const dequeueForProcessing = (count: number): string[] => {
  const state = useBatchStore.getState()
  const toProcess = state.mattingQueue.slice(0, count)
  
  if (toProcess.length === 0) return []

  useBatchStore.setState((prev) => ({
    mattingQueue: prev.mattingQueue.slice(count),
    mattingActive: [...prev.mattingActive, ...toProcess],
    images: prev.images.map((img) =>
      toProcess.includes(img.id) ? { ...img, status: 'matting' as const } : img
    ),
  }))

  return toProcess
}

export function useBatchMatting() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const processingRef = useRef<Set<string>>(new Set())

  const mattingQueue = useBatchStore((s) => s.mattingQueue)
  const mattingActive = useBatchStore((s) => s.mattingActive)
  const setMattingResult = useBatchStore((s) => s.setMattingResult)

  const processImage = useCallback(async (imageId: string, signal: AbortSignal) => {
    const image = useBatchStore.getState().images.find((img) => img.id === imageId)
    if (!image || !image.imageElement || !image.cropRect) {
      setMattingResult(imageId, null, '图片或裁剪区域不存在')
      return
    }

    if (processingRef.current.has(imageId)) return
    processingRef.current.add(imageId)

    try {
      const pngBytes = await getCroppedPngBytes(image.imageElement, image.cropRect)

      if (signal.aborted) {
        processingRef.current.delete(imageId)
        return
      }

      let lastResponseError: Error | null = null
      const maxAttempts = 2

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const blob = new Blob([pngBytes], { type: 'image/png' })
          const formData = new FormData()
          formData.append('image', blob, 'crop.png')

          const response = await fetch('/api/matting', {
            method: 'POST',
            body: formData,
            signal,
          })

          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.message || `抠图失败 (HTTP ${response.status})`)
          }

          const resultBlob = await response.blob()
          const resultBuf = new Uint8Array(await resultBlob.arrayBuffer())

          if (resultBlob.size === 0 || !validatePng(resultBuf)) {
            throw new Error('后端返回的 PNG 数据不完整')
          }

          const finalBlob = new Blob([resultBuf], { type: 'image/png' })
          const url = URL.createObjectURL(finalBlob)
          setMattingResult(imageId, url)
          return
        } catch (e) {
          if (signal.aborted) {
            processingRef.current.delete(imageId)
            return
          }
          lastResponseError = e as Error
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 150 * attempt))
          }
        }
      }

      throw lastResponseError || new Error('抠图请求失败')
    } catch (err) {
      if (!signal.aborted) {
        setMattingResult(imageId, null, (err as Error).message || '抠图失败')
      }
    } finally {
      processingRef.current.delete(imageId)
    }
  }, [setMattingResult])

  useEffect(() => {
    if (mattingQueue.length === 0) return

    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController()
    }

    const signal = abortControllerRef.current.signal

    const availableSlots = MAX_CONCURRENCY - mattingActive.length
    if (availableSlots <= 0) return

    const toProcess = dequeueForProcessing(availableSlots)

    toProcess.forEach((id) => {
      processImage(id, signal)
    })
  }, [mattingQueue, mattingActive, processImage])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      processingRef.current.clear()
    }
  }, [])
}
