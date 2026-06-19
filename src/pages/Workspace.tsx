import ImageUploader from '@/components/ImageUploader'
import CanvasViewer from '@/components/CanvasViewer'
import ControlPanel from '@/components/ControlPanel'
import ResultViewer from '@/components/ResultViewer'
import { useAppStore } from '@/store/useAppStore'
import { Scissors } from 'lucide-react'

export default function Workspace() {
  const status = useAppStore((s) => s.status)
  const isIdle = status === 'idle'
  const isDone = status === 'done'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-brand-bg">
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
          <div className="flex-1" />
          <span className="text-xs text-brand-text-dim">
            {isIdle ? '上传图片开始' : isDone ? '抠图完成' : '处理中...'}
          </span>
        </header>

        <main className="flex-1 relative">
          {isIdle && <ImageUploader />}
          {!isIdle && !isDone && <CanvasViewer />}
          {isDone && <ResultViewer />}
        </main>
      </div>

      {!isIdle && <ControlPanel />}
    </div>
  )
}
