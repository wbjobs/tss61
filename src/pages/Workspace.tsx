import { useMemo } from 'react'
import ImageUploader from '@/components/ImageUploader'
import CanvasViewer from '@/components/CanvasViewer'
import ControlPanel from '@/components/ControlPanel'
import QueuePanel from '@/components/QueuePanel'
import { useBatchStore } from '@/store/useBatchStore'
import { useBatchMatting } from '@/hooks/useBatchMatting'
import { useBatchEdgeDetection } from '@/hooks/useBatchEdgeDetection'
import { Scissors, Layers } from 'lucide-react'

export default function Workspace() {
  useBatchMatting()
  useBatchEdgeDetection()

  const images = useBatchStore((s) => s.images)
  const activeImageId = useBatchStore((s) => s.activeImageId)
  const getProgress = useBatchStore((s) => s.getProgress)

  const hasImages = images.length > 0
  const activeImage = useMemo(
    () => images.find((img) => img.id === activeImageId) ?? null,
    [images, activeImageId]
  )

  const progress = useMemo(() => getProgress(), [images, getProgress])
  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-brand-bg">
      <QueuePanel />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-6 py-3 border-b border-brand-border bg-brand-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-brand-accent" />
            </div>
            <h1 className="font-display text-lg font-semibold text-brand-text">
              EdgeCut
            </h1>
          </div>
          <span className="text-xs text-brand-text-dim border border-brand-border rounded-full px-2.5 py-0.5">
            智能抠图
          </span>

          {hasImages && (
            <div className="flex items-center gap-3 ml-4">
              <div className="h-5 w-px bg-brand-border" />
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-accent" />
                <span className="text-sm text-brand-text font-medium">
                  {progress.total} 张图片
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-brand-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-accent transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-brand-text-dim font-mono">
                  {progressPercent}%
                </span>
              </div>
              <div className="text-xs text-brand-text-dim">
                {progress.done} 完成 · {progress.active} 进行中 · {progress.failed} 失败
              </div>
            </div>
          )}

          <div className="flex-1" />
          <span className="text-xs text-brand-text-dim">
            {!hasImages ? '上传图片开始' : progress.done === progress.total && progress.total > 0 ? '全部完成' : '处理中...'}
          </span>
        </header>

        <main className="flex-1 relative">
          {hasImages ? <CanvasViewer /> : <ImageUploader />}
        </main>
      </div>

      {activeImage && <ControlPanel />}
    </div>
  )
}
