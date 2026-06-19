import { useState, useRef, useCallback } from 'react'
import { Upload, ImagePlus, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const MAX_SIZE = 20 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export default function ImageUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setImage = useAppStore((s) => s.setImage)
  const storeSetError = useAppStore((s) => s.setError)

  const processFile = useCallback((file: File) => {
    setError(null)
    storeSetError(null)

    if (!ACCEPTED.includes(file.type)) {
      setError('请上传 JPG、PNG 或 WebP 格式的图片')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('图片大小不能超过 20MB')
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      setImage(img, imageData)
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      setError('图片加载失败，请重试')
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }, [setImage, storeSetError])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }, [processFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    e.target.value = ''
  }, [processFile])

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-8">
      <div
        className={`
          relative flex flex-col items-center justify-center w-full max-w-xl aspect-[4/3]
          rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          ${isDragging
            ? 'border-brand-accent bg-brand-accent/5 shadow-glow-lg'
            : 'border-brand-border bg-brand-surface/50 hover:border-brand-muted hover:bg-brand-surface/80'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />

        {isDragging ? (
          <ImagePlus className="w-16 h-16 text-brand-accent mb-4 animate-pulse-glow" />
        ) : (
          <Upload className="w-16 h-16 text-brand-text-dim mb-4" />
        )}

        <p className="font-display text-xl font-semibold text-brand-text mb-2">
          {isDragging ? '释放以上传图片' : '拖拽图片到此处'}
        </p>
        <p className="font-body text-sm text-brand-text-dim">
          或点击选择文件 · 支持 JPG / PNG / WebP · 最大 20MB
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-400 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-body text-sm">{error}</span>
        </div>
      )}
    </div>
  )
}
