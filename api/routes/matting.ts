import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { mattingService } from '../services/mattingService.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
const iendSig = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]

function validatePngBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length === 0) {
    return '图片数据为空'
  }

  if (buffer.length < 12) {
    return '图片数据不完整'
  }

  for (let i = 0; i < pngSignature.length; i++) {
    if (buffer[i] !== pngSignature[i]) {
      return '非 PNG 格式的图片'
    }
  }

  const endSlice = buffer.slice(buffer.length - 8, buffer.length)
  for (let i = 0; i < iendSig.length; i++) {
    if (endSlice[i] !== iendSig[i]) {
      return 'PNG 图片数据不完整（缺少 IEND 块）'
    }
  }

  if (buffer.length > 200) {
    const ihdrStart = 8
    const ihdrLen =
      (buffer[ihdrStart] << 24) |
      (buffer[ihdrStart + 1] << 16) |
      (buffer[ihdrStart + 2] << 8) |
      buffer[ihdrStart + 3]
    if (ihdrLen !== 13) {
      return 'PNG 图片结构异常（无效 IHDR）'
    }
  }

  return null
}

function validateResultBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length === 0) {
    return '抠图结果为空'
  }

  for (let i = 0; i < pngSignature.length; i++) {
    if (buffer[i] !== pngSignature[i]) {
      return '抠图结果生成失败'
    }
  }

  const rEndSlice = buffer.slice(buffer.length - 8, buffer.length)
  for (let i = 0; i < iendSig.length; i++) {
    if (rEndSlice[i] !== iendSig[i]) {
      return '抠图结果生成不完整'
    }
  }

  return null
}

router.post(
  '/',
  upload.single('image'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'Bad Request', message: 'No image file provided' })
        return
      }

      const validationError = validatePngBuffer(file.buffer)
      if (validationError) {
        res.status(400).json({ error: 'Bad Request', message: validationError })
        return
      }

      const resultBuffer = await mattingService.processImageConcurrent(file.buffer)

      const resultError = validateResultBuffer(resultBuffer)
      if (resultError) {
        res.status(500).json({ error: 'Matting Failed', message: resultError })
        return
      }

      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Content-Length', String(resultBuffer.length))
      res.status(200).send(resultBuffer)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: 'Matting Failed', message })
    }
  }
)

router.post(
  '/batch',
  upload.array('image', 20),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[] | undefined

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'No image files provided' })
        return
      }

      if (files.length > 20) {
        res.status(400).json({ error: 'Bad Request', message: '最多允许 20 张图片' })
        return
      }

      const results = await Promise.all(
        files.map(async (file) => {
          const id = uuidv4()
          try {
            const validationError = validatePngBuffer(file.buffer)
            if (validationError) {
              return { id, status: 'error' as const, error: validationError }
            }

            const resultBuffer = await mattingService.processImageConcurrent(file.buffer)

            const resultError = validateResultBuffer(resultBuffer)
            if (resultError) {
              return { id, status: 'error' as const, error: resultError }
            }

            return { id, status: 'success' as const, buffer: resultBuffer.toString('base64') }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            return { id, status: 'error' as const, error: message }
          }
        })
      )

      res.status(200).json({ results })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: 'Batch Matting Failed', message })
    }
  }
)

router.get('/health', (_req: Request, res: Response): void => {
  const queueStatus = mattingService.getQueueStatus()
  res.status(200).json({
    status: 'ok',
    onnxReady: false,
    queue: queueStatus,
  })
})

export default router
