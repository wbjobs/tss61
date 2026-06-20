import { useState, useRef, useCallback } from 'react'
import { Upload, ImagePlus, AlertCircle } from 'lucide-react'
import { useBatchStore } from '@/store/useBatchStore'

const MAX_SIZE = 20 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGES = 20

export default function ImageUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const images = useBatchStore((s) => s.images)
  const addImages = useBatchStore((s) => s.addImages)

  if (images.length > 0) {
    return null
  }

  const validateFiles = useCallback((files: File[]): { valid: File[]; error: string | null } => {
    const validFiles: File[] = []

    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) {
        return { valid: [], error: '请上传 JPG、PNG 或 WebP 格式的图片' }
      }
      if (file.size > MAX_SIZE) {
        return { valid: [], error: '图片大小不能超过 20MB' }
      }
      validFiles.push(file)
    }

    if (validFiles.length + images.length > MAX_IMAGES) {
      return { valid: [], error: `最多支持 ${MAX_IMAGES} 张图片` }
    }

    return { valid: validFiles, error: null }
  }, [images.length])

  const processFiles = useCallback((files: File[]) => {
    setError(null)

    const { valid, error: validationError } = validateFiles(files)
    if (validationError) {
      setError(validationError)
      return
    }

    if (valid.length > 0) {
      addImages(valid)
    }
  }, [addImages, validateFiles])

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

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      processFiles(files)
    }
  }, [processFiles])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length > 0) {
      processFiles(files)
    }
    e.target.value = ''
  }, [processFiles])

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
          multiple
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
          或点击选择文件 · 支持批量上传，最多 {MAX_IMAGES} 张 · JPG / PNG / WebP · 单张最大 20MB
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
