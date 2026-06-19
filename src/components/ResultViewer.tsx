import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useState, useCallback } from 'react'

export default function ResultViewer() {
  const resultImage = useAppStore((s) => s.resultImage)
  const reset = useAppStore((s) => s.reset)
  const [zoom, setZoom] = useState(1)

  const handleDownload = useCallback(() => {
    if (!resultImage) return
    const a = document.createElement('a')
    a.href = resultImage
    a.download = 'cutout-result.png'
    a.click()
  }, [resultImage])

  if (!resultImage) return null

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-6 p-8">
      <div className="relative checkerboard rounded-xl overflow-hidden shadow-2xl border border-brand-border max-w-[600px] max-h-[500px]">
        <img
          src={resultImage}
          alt="抠图结果"
          className="max-w-full max-h-[500px] object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          className="p-2 rounded-lg bg-brand-surface border border-brand-border text-brand-text-dim hover:text-brand-accent hover:border-brand-accent/50 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-sm font-mono text-brand-text-dim w-16 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          className="p-2 rounded-lg bg-brand-surface border border-brand-border text-brand-text-dim hover:text-brand-accent hover:border-brand-accent/50 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-accent text-brand-bg font-display font-semibold text-sm hover:bg-brand-accent-dim shadow-glow transition-all"
        >
          <Download className="w-4 h-4" />
          下载 PNG
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-surface border border-brand-border text-sm text-brand-text hover:border-brand-accent/50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          新图片
        </button>
      </div>
    </div>
  )
}
