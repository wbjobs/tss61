import { create } from 'zustand'

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

type AppStatus = 'idle' | 'detecting' | 'adjusting' | 'matting' | 'done' | 'error'

interface AppState {
  originalImage: HTMLImageElement | null
  originalImageData: ImageData | null
  edgeRgba: Uint8ClampedArray | null
  cropRect: CropRect | null
  resultImage: string | null
  status: AppStatus
  sensitivity: number
  showEdges: boolean
  errorMessage: string | null
  detectTrigger: number

  setImage: (img: HTMLImageElement, data: ImageData) => void
  setEdgeResult: (edgeRgba: Uint8ClampedArray) => void
  setCropRect: (rect: CropRect) => void
  setResultImage: (url: string) => void
  setStatus: (status: AppStatus) => void
  setSensitivity: (val: number) => void
  toggleEdges: () => void
  setError: (msg: string | null) => void
  triggerRedetect: () => void
  reset: () => void
}

const initialState = {
  originalImage: null,
  originalImageData: null,
  edgeRgba: null,
  cropRect: null,
  resultImage: null,
  status: 'idle' as AppStatus,
  sensitivity: 50,
  showEdges: true,
  errorMessage: null,
  detectTrigger: 0,
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setImage: (img, data) =>
    set({
      originalImage: img,
      originalImageData: data,
      status: 'detecting',
      resultImage: null,
      errorMessage: null,
      cropRect: null,
      edgeRgba: null,
      detectTrigger: 0,
    }),

  setEdgeResult: (edgeRgba) =>
    set({ edgeRgba, status: 'adjusting' }),

  setCropRect: (cropRect) =>
    set({ cropRect }),

  setResultImage: (resultImage) =>
    set({ resultImage, status: 'done' }),

  setStatus: (status) =>
    set({ status }),

  setSensitivity: (sensitivity) =>
    set({ sensitivity }),

  toggleEdges: () =>
    set((state) => ({ showEdges: !state.showEdges })),

  setError: (errorMessage) =>
    set({ errorMessage, status: errorMessage ? 'error' : 'idle' }),

  triggerRedetect: () =>
    set((state) => ({
      detectTrigger: state.detectTrigger + 1,
      status: 'detecting',
      edgeRgba: null,
      cropRect: null,
    })),

  reset: () =>
    set(initialState),
}))
