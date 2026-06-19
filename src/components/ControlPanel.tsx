import { useCallback } from 'react'
import { Eye, EyeOff, RefreshCw, Scissors, RotateCcw, Loader2, Download, Crop, Settings2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

export default function ControlPanel() {
  const status = useAppStore((s) => s.status)
  const sensitivity = useAppStore((s) => s.sensitivity)
  const showEdges = useAppStore((s) => s.showEdges)
  const cropRect = useAppStore((s) => s.cropRect)
  const resultImage = useAppStore((s) => s.resultImage)
  const originalImage = useAppStore((s) => s.originalImage)

  const setSensitivity = useAppStore((s) => s.setSensitivity)
  const toggleEdges = useAppStore((s) => s.toggleEdges)
  const triggerRedetect = useAppStore((s) => s.triggerRedetect)
  const setResultImage = useAppStore((s) => s.setResultImage)
  const reset = useAppStore((s) => s.reset)
  const setError = useAppStore((s) => s.setError)

  const handleMatting = useCallback(async () => {
    if (!originalImage || !cropRect) return

    useAppStore.getState().setStatus('matting')

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

    const getPngBytes = async (): Promise<Uint8Array> => {
      const maxAttempts = 3
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(cropRect.width))
          canvas.height = Math.max(1, Math.round(cropRect.height))
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(
            originalImage,
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

    try {
      const pngBytes = await getPngBytes()

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
          setResultImage(url)
          return
        } catch (e) {
          lastResponseError = e as Error
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 150 * attempt))
          }
        }
      }

      throw lastResponseError || new Error('抠图请求失败')
    } catch (err) {
      setError((err as Error).message || '抠图失败')
    }
  }, [originalImage, cropRect, setResultImage, setError])

  const handleDownload = useCallback(() => {
    if (!resultImage) return
    const a = document.createElement('a')
    a.href = resultImage
    a.download = 'cutout-result.png'
    a.click()
  }, [resultImage])

  const handleRedetect = useCallback(() => {
    triggerRedetect()
  }, [triggerRedetect])

  const isIdle = status === 'idle'
  const isDetecting = status === 'detecting'
  const isAdjusting = status === 'adjusting'
  const isMatting = status === 'matting'
  const isDone = status === 'done'

  return (
    <div className="w-72 h-full bg-brand-surface border-l border-brand-border flex flex-col">
      <div className="px-5 py-4 border-b border-brand-border">
        <h2 className="font-display text-lg font-semibold text-brand-text flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-brand-accent" />
          控制面板
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <div className="space-y-3">
          <StepIndicator step={1} label="上传图片" done={!isIdle} active={isIdle} />
          <StepIndicator step={2} label="边缘检测" done={isAdjusting || isMatting || isDone} active={isDetecting} />
          <StepIndicator step={3} label="调整裁剪" done={isMatting || isDone} active={isAdjusting} />
          <StepIndicator step={4} label="AI 抠图" done={isDone} active={isMatting} />
        </div>

        {!isIdle && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-text-dim flex items-center justify-between">
              检测灵敏度
              <span className="text-brand-accent font-mono text-xs">{sensitivity}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={100}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-full h-1.5 bg-brand-muted rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-accent
                [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:cursor-pointer"
              disabled={isDetecting || isMatting}
            />
          </div>
        )}

        {(isAdjusting || isDone) && (
          <button
            onClick={toggleEdges}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-brand-bg border border-brand-border text-sm text-brand-text hover:border-brand-accent/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              {showEdges ? <Eye className="w-4 h-4 text-brand-accent" /> : <EyeOff className="w-4 h-4 text-brand-text-dim" />}
              边缘轮廓
            </span>
            <span className={`text-xs ${showEdges ? 'text-brand-accent' : 'text-brand-text-dim'}`}>
              {showEdges ? '显示' : '隐藏'}
            </span>
          </button>
        )}

        {isAdjusting && (
          <button
            onClick={handleRedetect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-bg border border-brand-border text-sm text-brand-text hover:border-brand-accent/50 hover:text-brand-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新检测
          </button>
        )}

        {cropRect && (isAdjusting || isMatting) && (
          <div className="text-xs text-brand-text-dim space-y-1 bg-brand-bg/50 rounded-lg p-3">
            <div className="flex justify-between">
              <span>裁剪区域</span>
              <span className="text-brand-text font-mono">{Math.round(cropRect.width)}×{Math.round(cropRect.height)}</span>
            </div>
            <div className="flex justify-between">
              <span>位置</span>
              <span className="text-brand-text font-mono">({Math.round(cropRect.x)}, {Math.round(cropRect.y)})</span>
            </div>
          </div>
        )}

        {isAdjusting && (
          <button
            onClick={handleMatting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-accent text-brand-bg font-display font-semibold text-sm hover:bg-brand-accent-dim shadow-glow transition-all hover:shadow-glow-lg"
          >
            <Scissors className="w-4 h-4" />
            确认抠图
          </button>
        )}

        {isMatting && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            AI 正在抠图...
          </div>
        )}

        {isDone && resultImage && (
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-accent text-brand-bg font-display font-semibold text-sm hover:bg-brand-accent-dim shadow-glow transition-all hover:shadow-glow-lg"
          >
            <Download className="w-4 h-4" />
            下载结果
          </button>
        )}

        {isDone && (
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-bg border border-brand-border text-sm text-brand-text hover:border-brand-accent/50 hover:text-brand-accent transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            处理新图片
          </button>
        )}
      </div>

      <div className="px-5 py-3 border-t border-brand-border text-xs text-brand-text-dim text-center">
        EdgeCut · 前端 Wasm 边缘检测 + 后端 AI 抠图
      </div>
    </div>
  )
}

function StepIndicator({ step, label, done, active }: { step: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all
        ${done ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/50' :
          active ? 'bg-brand-accent text-brand-bg shadow-glow' :
          'bg-brand-muted/30 text-brand-text-dim'}`}>
        {done ? '✓' : step}
      </div>
      <span className={`text-sm ${active ? 'text-brand-text font-medium' : done ? 'text-brand-text-dim' : 'text-brand-text-dim/50'}`}>
        {label}
      </span>
      {active && <Loader2 className="w-3 h-3 text-brand-accent animate-spin ml-auto" />}
    </div>
  )
}
