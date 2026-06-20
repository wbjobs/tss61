import { useCallback, useMemo } from 'react'
import { Eye, EyeOff, RefreshCw, Scissors, RotateCcw, Loader2, Download, Settings2, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { useBatchStore } from '@/store/useBatchStore'

export default function ControlPanel() {
  const images = useBatchStore((s) => s.images)
  const activeImageId = useBatchStore((s) => s.activeImageId)
  const setActiveImage = useBatchStore((s) => s.setActiveImage)
  const setSensitivity = useBatchStore((s) => s.setSensitivity)
  const toggleEdges = useBatchStore((s) => s.toggleEdges)
  const triggerRedetect = useBatchStore((s) => s.triggerRedetect)
  const startMattingSingle = useBatchStore((s) => s.startMattingSingle)
  const reset = useBatchStore((s) => s.reset)
  const getProgress = useBatchStore((s) => s.getProgress)

  const activeImage = useMemo(
    () => images.find((img) => img.id === activeImageId) ?? null,
    [images, activeImageId]
  )

  const progress = useMemo(() => getProgress(), [images, getProgress])

  const currentIndex = useMemo(() => {
    if (!activeImageId) return -1
    return images.findIndex((img) => img.id === activeImageId)
  }, [images, activeImageId])

  const hasMultiple = images.length > 1
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex >= 0 && currentIndex < images.length - 1

  const handlePrev = useCallback(() => {
    if (canGoPrev) {
      setActiveImage(images[currentIndex - 1].id)
    }
  }, [canGoPrev, images, currentIndex, setActiveImage])

  const handleNext = useCallback(() => {
    if (canGoNext) {
      setActiveImage(images[currentIndex + 1].id)
    }
  }, [canGoNext, images, currentIndex, setActiveImage])

  const handleMatting = useCallback(() => {
    if (!activeImage || activeImage.status !== 'adjusting') return
    startMattingSingle(activeImage.id)
  }, [activeImage, startMattingSingle])

  const handleDownload = useCallback(() => {
    if (!activeImage?.resultImage) return
    const a = document.createElement('a')
    a.href = activeImage.resultImage
    const baseName = activeImage.file.name.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}_matting.png`
    a.click()
  }, [activeImage])

  const handleRedetect = useCallback(() => {
    if (!activeImage) return
    triggerRedetect(activeImage.id)
  }, [activeImage, triggerRedetect])

  const handleSensitivityChange = useCallback(
    (val: number) => {
      if (!activeImage) return
      setSensitivity(val, activeImage.id)
    },
    [activeImage, setSensitivity]
  )

  const handleToggleEdges = useCallback(() => {
    if (!activeImage) return
    toggleEdges(activeImage.id)
  }, [activeImage, toggleEdges])

  const isIdle = !activeImage
  const isDetecting = !!(activeImage && (
    activeImage.status === 'detecting' ||
    (activeImage.status === 'queued' && !activeImage.cropRect)
  ))
  const isAdjusting = activeImage?.status === 'adjusting'
  const isMatting = !!(activeImage && (
    activeImage.status === 'matting' ||
    (activeImage.status === 'queued' && activeImage.cropRect)
  ))
  const isDone = activeImage?.status === 'done'
  const isError = activeImage?.status === 'error'

  const sensitivity = activeImage?.sensitivity ?? 50
  const showEdges = activeImage?.showEdges ?? true
  const cropRect = activeImage?.cropRect ?? null
  const resultImage = activeImage?.resultImage ?? null

  return (
    <div className="w-72 h-full bg-brand-surface border-l border-brand-border flex flex-col">
      <div className="px-5 py-4 border-b border-brand-border">
        <h2 className="font-display text-lg font-semibold text-brand-text flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-brand-accent" />
          控制面板
        </h2>
      </div>

      {hasMultiple && (
        <div className="px-5 py-3 border-b border-brand-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-brand-text-dim flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              批量处理
            </span>
            <span className="text-xs text-brand-text font-medium">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-brand-bg border border-brand-border text-sm text-brand-text hover:border-brand-accent/50 hover:text-brand-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              上一张
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-brand-bg border border-brand-border text-sm text-brand-text hover:border-brand-accent/50 hover:text-brand-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一张
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-brand-text-dim">
              <span>整体进度</span>
              <span className="text-brand-text font-medium">
                {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-brand-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-accent transition-all duration-300 ease-out"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="text-xs text-brand-text-dim">
              {progress.done} 完成 · {progress.active} 进行中 · {progress.total - progress.done - progress.failed - progress.active} 等待
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <div className="space-y-3">
          <StepIndicator step={1} label="上传图片" done={!isIdle} active={isIdle} />
          <StepIndicator step={2} label="边缘检测" done={isAdjusting || isMatting || isDone || isError} active={isDetecting} />
          <StepIndicator step={3} label="调整裁剪" done={isMatting || isDone || isError} active={isAdjusting} />
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
              onChange={(e) => handleSensitivityChange(Number(e.target.value))}
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
            onClick={handleToggleEdges}
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
            {activeImage?.status === 'queued' ? '等待抠图...' : 'AI 正在抠图...'}
          </div>
        )}

        {isError && activeImage?.errorMessage && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="font-medium mb-1">处理失败</div>
            <div className="text-red-300/80">{activeImage.errorMessage}</div>
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
