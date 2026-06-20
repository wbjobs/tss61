import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

type ImageStatus = 'queued' | 'detecting' | 'adjusting' | 'matting' | 'done' | 'error'

interface ImageItem {
  id: string
  file: File
  imageElement: HTMLImageElement | null
  originalImageData: ImageData | null
  edgeRgba: Uint8ClampedArray | null
  cropRect: { x: number; y: number; width: number; height: number } | null
  resultImage: string | null
  status: ImageStatus
  errorMessage: string | null
  sensitivity: number
  showEdges: boolean
  detectTrigger: number
}

interface BatchState {
  images: ImageItem[]
  activeImageId: string | null
  batchMode: boolean
  sensitivity: number
  globalShowEdges: boolean
  concurrency: number
  mattingQueue: string[]
  mattingActive: string[]

  addImages: (files: File[]) => Promise<void>
  removeImage: (id: string) => void
  setActiveImage: (id: string | null) => void
  setSensitivity: (val: number, id?: string) => void
  toggleEdges: (id?: string) => void
  setEdgeResult: (id: string, edgeRgba: Uint8ClampedArray) => void
  setCropRect: (id: string, rect: { x: number; y: number; width: number; height: number }) => void
  triggerRedetect: (id: string) => void
  startMattingAll: () => void
  startMattingSingle: (id: string) => void
  setMattingResult: (id: string, resultUrl: string | null, error?: string) => void
  updateStatus: (id: string, status: ImageStatus) => void
  setImageError: (id: string, errorMessage: string) => void
  retryMatting: (id: string) => void
  reset: () => void
  downloadAll: () => void
  getActiveImage: () => ImageItem | null
  getProgress: () => { total: number; done: number; failed: number; active: number }
}

const MAX_IMAGES = 20

const loadImage = (file: File): Promise<{ imageElement: HTMLImageElement; imageData: ImageData }> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      resolve({ imageElement: img, imageData })
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
    img.src = URL.createObjectURL(file)
  })
}

const initialState = {
  images: [] as ImageItem[],
  activeImageId: null as string | null,
  batchMode: false,
  sensitivity: 50,
  globalShowEdges: true,
  concurrency: 3,
  mattingQueue: [] as string[],
  mattingActive: [] as string[],
}

export const useBatchStore = create<BatchState>((set, get) => ({
  ...initialState,

  addImages: async (files: File[]) => {
    const state = get()
    const remainingSlots = MAX_IMAGES - state.images.length
    const filesToAdd = files.slice(0, remainingSlots)

    if (filesToAdd.length === 0) return

    const newImages: ImageItem[] = filesToAdd.map((file) => ({
      id: uuidv4(),
      file,
      imageElement: null,
      originalImageData: null,
      edgeRgba: null,
      cropRect: null,
      resultImage: null,
      status: 'queued' as ImageStatus,
      errorMessage: null,
      sensitivity: state.sensitivity,
      showEdges: state.globalShowEdges,
      detectTrigger: 0,
    }))

    set((prev) => ({
      images: [...prev.images, ...newImages],
      activeImageId: prev.activeImageId ?? newImages[0]?.id ?? null,
      batchMode: prev.images.length + newImages.length > 1,
    }))

    for (const imageItem of newImages) {
      try {
        const { imageElement, imageData } = await loadImage(imageItem.file)
        set((prev) => ({
          images: prev.images.map((img) =>
            img.id === imageItem.id
              ? { ...img, imageElement, originalImageData: imageData, status: 'detecting' as ImageStatus }
              : img
          ),
        }))
      } catch (error) {
        set((prev) => ({
          images: prev.images.map((img) =>
            img.id === imageItem.id
              ? {
                  ...img,
                  status: 'error' as ImageStatus,
                  errorMessage: error instanceof Error ? error.message : 'Failed to load image',
                }
              : img
          ),
        }))
      }
    }
  },

  removeImage: (id: string) => {
    set((prev) => {
      const filteredImages = prev.images.filter((img) => img.id !== id)
      const newActiveId =
        prev.activeImageId === id
          ? filteredImages.length > 0
            ? filteredImages[0].id
            : null
          : prev.activeImageId

      return {
        images: filteredImages,
        activeImageId: newActiveId,
        batchMode: filteredImages.length > 1,
        mattingQueue: prev.mattingQueue.filter((qid) => qid !== id),
        mattingActive: prev.mattingActive.filter((aid) => aid !== id),
      }
    })
  },

  setActiveImage: (id: string | null) => {
    set({ activeImageId: id })
  },

  setSensitivity: (val: number, id?: string) => {
    if (id) {
      set((prev) => ({
        images: prev.images.map((img) =>
          img.id === id ? { ...img, sensitivity: val } : img
        ),
      }))
    } else {
      set({ sensitivity: val })
    }
  },

  toggleEdges: (id?: string) => {
    if (id) {
      set((prev) => ({
        images: prev.images.map((img) =>
          img.id === id ? { ...img, showEdges: !img.showEdges } : img
        ),
      }))
    } else {
      set((prev) => ({ globalShowEdges: !prev.globalShowEdges }))
    }
  },

  setEdgeResult: (id: string, edgeRgba: Uint8ClampedArray) => {
    set((prev) => ({
      images: prev.images.map((img) =>
        img.id === id ? { ...img, edgeRgba, status: 'adjusting' as ImageStatus } : img
      ),
    }))
  },

  setCropRect: (id: string, rect: { x: number; y: number; width: number; height: number }) => {
    set((prev) => ({
      images: prev.images.map((img) =>
        img.id === id ? { ...img, cropRect: rect } : img
      ),
    }))
  },

  triggerRedetect: (id: string) => {
    set((prev) => ({
      images: prev.images.map((img) =>
        img.id === id
          ? {
              ...img,
              detectTrigger: img.detectTrigger + 1,
              status: 'detecting' as ImageStatus,
              edgeRgba: null,
              cropRect: null,
            }
          : img
      ),
    }))
  },

  startMattingAll: () => {
    set((prev) => {
      const adjustingIds = prev.images
        .filter((img) => img.status === 'adjusting')
        .map((img) => img.id)

      const updatedImages = prev.images.map((img) =>
        adjustingIds.includes(img.id) ? { ...img, status: 'queued' as ImageStatus } : img
      )

      return {
        images: updatedImages,
        mattingQueue: [...prev.mattingQueue, ...adjustingIds],
      }
    })
  },

  startMattingSingle: (id: string) => {
    set((prev) => {
      const image = prev.images.find((img) => img.id === id)
      if (!image || image.status !== 'adjusting') return prev

      return {
        images: prev.images.map((img) =>
          img.id === id ? { ...img, status: 'queued' as ImageStatus } : img
        ),
        mattingQueue: [...prev.mattingQueue, id],
      }
    })
  },

  setMattingResult: (id: string, resultUrl: string | null, error?: string) => {
    set((prev) => ({
      images: prev.images.map((img) =>
        img.id === id
          ? {
              ...img,
              resultImage: resultUrl,
              status: error ? ('error' as const) : ('done' as const),
              errorMessage: error ?? null,
            }
          : img
      ),
      mattingActive: prev.mattingActive.filter((aid) => aid !== id),
    }))
  },

  updateStatus: (id: string, status: ImageStatus) => {
    set((prev) => ({
      images: prev.images.map((img) =>
        img.id === id ? { ...img, status } : img
      ),
    }))
  },

  setImageError: (id: string, errorMessage: string) => {
    set((prev) => ({
      images: prev.images.map((img) =>
        img.id === id ? { ...img, status: 'error' as ImageStatus, errorMessage } : img
      ),
    }))
  },

  retryMatting: (id: string) => {
    set((prev) => {
      const image = prev.images.find((img) => img.id === id)
      if (!image || image.status !== 'error') return prev

      return {
        images: prev.images.map((img) =>
          img.id === id
            ? { ...img, status: 'queued' as ImageStatus, errorMessage: null }
            : img
        ),
        mattingQueue: [...prev.mattingQueue, id],
      }
    })
  },

  reset: () => {
    get().images.forEach((img) => {
      if (img.imageElement?.src) {
        URL.revokeObjectURL(img.imageElement.src)
      }
      if (img.resultImage) {
        URL.revokeObjectURL(img.resultImage)
      }
    })
    set(initialState)
  },

  downloadAll: () => {
    const state = get()
    const doneImages = state.images.filter((img) => img.status === 'done' && img.resultImage)

    doneImages.forEach((img, index) => {
      if (!img.resultImage) return

      const link = document.createElement('a')
      link.href = img.resultImage
      const baseName = img.file.name.replace(/\.[^/.]+$/, '')
      link.download = `${baseName}_matting_${index + 1}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  },

  getActiveImage: () => {
    const state = get()
    return state.images.find((img) => img.id === state.activeImageId) ?? null
  },

  getProgress: () => {
    const state = get()
    const total = state.images.length
    const done = state.images.filter((img) => img.status === 'done').length
    const failed = state.images.filter((img) => img.status === 'error').length
    const active = state.mattingActive.length

    return { total, done, failed, active }
  },
}))
