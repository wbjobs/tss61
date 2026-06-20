import { useMemo, useEffect, useState } from 'react'
import {
  Layers,
  Clock,
  Loader2,
  Crop,
  Check,
  AlertCircle,
  X,
  Download,
  Play,
  Trash2,
  Scissors,
} from 'lucide-react'
import { useBatchStore } from '@/store/useBatchStore'

type StatusConfig = {
  icon: React.ComponentType<any>
  color: string
  label: string
  spin?: boolean
}

const statusConfig: Record<string, StatusConfig> = {
  queued: { icon: Clock, color: 'text-brand-text-dim', label: '等待处理' },
  detecting: { icon: Loader2, color: 'text-brand-accent/70', label: '边缘检测中', spin: true },
  adjusting: { icon: Crop, color: 'text-brand-accent', label: '待裁剪' },
  matting: { icon: Loader2, color: 'text-brand-accent', label: 'AI抠图中', spin: true },
  done: { icon: Check, color: 'text-green-400', label: '已完成' },
  error: { icon: AlertCircle, color: 'text-red-400', label: '处理失败' },
}

function Thumbnail({ item }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let objectUrl = null
    if (item.imageElement) {
      setSrc(item.imageElement.src)
    } else {
      objectUrl = URL.createObjectURL(item.file)
      setSrc(objectUrl)
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [item.imageElement, item.file])

  return (
    <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-brand-muted">
      {src ? (
        <img src={src} alt={item.file.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-brand-text-dim animate-spin" />
        </div>
      )}
    </div>
  )
}

export default function QueuePanel() {
  const images = useBatchStore((s) => s.images)
  const activeImageId = useBatchStore((s) => s.activeImageId)
  const setActiveImage = useBatchStore((s) => s.setActiveImage)
  const removeImage = useBatchStore((s) => s.removeImage)
  const startMattingAll = useBatchStore((s) => s.startMattingAll)
  const downloadAll = useBatchStore((s) => s.downloadAll)
  const reset = useBatchStore((s) => s.reset)
  const getProgress = useBatchStore((s) => s.getProgress)
  const triggerRedetect = useBatchStore((s) => s.triggerRedetect)
  const retryMatting = useBatchStore((s) => s.retryMatting)

  const progress = useMemo(() => getProgress(), [images, getProgress])

  const hasAdjusting = images.some((img) => img.status === 'adjusting')
  const hasDone = images.some((img) => img.status === 'done' && img.resultImage)

  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const handleDownload = (e, resultUrl, fileName) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = resultUrl
    const baseName = fileName.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}_matting.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleRetry = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const img = images.find((i) => i.id === id)
    if (!img) return
    if (img.cropRect) {
      retryMatting(id)
    } else {
      triggerRedetect(id)
    }
  }

  const handleRemove = (e, id) => {
    e.stopPropagation()
    removeImage(id)
  }

  return (
    <div className="w-[280px] h-full bg-brand-surface border-r border-brand-border flex flex-col">
      <div className="px-4 py-3 border-b border-brand-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-brand-text flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-accent" />
            处理队列
          </h2>
          <span className="text-sm font-normal text-brand-text-dim bg-brand-muted/50 px-2 py-0.5 rounded-full">
            {images.length} 张
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-brand-text-dim">
            <span>整体进度</span>
            <span className="text-brand-text font-medium">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-brand-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-brand-text-dim">
            {progress.done} 完成 · {progress.active} 进行中 · {progress.total - progress.done - progress.failed - progress.active} 等待
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-brand-text-dim py-8">
            <Scissors className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">暂无图片</p>
          </div>
        ) : (
          images.map((item) => {
            const config = statusConfig[item.status]
            const StatusIcon = config.icon
            const isActive = activeImageId === item.id

            return (
              <div
                key={item.id}
                onClick={() => setActiveImage(item.id)}
                className={`
                  relative flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200
                  ${isActive
                    ? 'bg-brand-accent/10 border-2 border-brand-accent shadow-glow'
                    : 'bg-brand-bg/50 border-2 border-transparent hover:bg-brand-bg hover:border-brand-border'}
                `}
              >
                <Thumbnail item={item} />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm text-brand-text truncate font-medium"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusIcon
                      className={`w-3.5 h-3.5 ${config.color} ${config.spin ? 'animate-spin' : ''}`}
                    />
                    <span className={`text-xs ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  {item.status === 'error' && item.errorMessage && (
                    <p className="text-xs text-red-400 truncate mt-0.5" title={item.errorMessage}>
                      {item.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {item.status === 'done' && item.resultImage && (
                    <button
                      onClick={(e) => handleDownload(e, item.resultImage!, item.file.name)}
                      className="p-1.5 rounded-md hover:bg-green-500/20 text-green-400 transition-colors"
                      title="下载"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  {item.status === 'error' && (
                    <button
                      onClick={(e) => handleRetry(e, item.id)}
                      className="p-1.5 rounded-md hover:bg-brand-accent/20 text-brand-accent transition-colors"
                      title="重试"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleRemove(e, item.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/20 text-brand-text-dim hover:text-red-400 transition-colors"
                    title="移除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="p-3 border-t border-brand-border space-y-2">
        {hasAdjusting && (
          <button
            onClick={startMattingAll}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-accent text-brand-bg font-display font-semibold text-sm hover:bg-brand-accent-dim shadow-glow transition-all"
          >
            <Scissors className="w-4 h-4" />
            全部处理
          </button>
        )}

        {hasDone && (
          <button
            onClick={downloadAll}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 text-white font-display font-semibold text-sm hover:bg-green-600 transition-all"
          >
            <Download className="w-4 h-4" />
            全部下载
          </button>
        )}

        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-bg border border-brand-border text-sm text-brand-text-dim hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          清空全部
        </button>
      </div>
    </div>
  )
}
