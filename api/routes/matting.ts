import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { mattingService } from '../services/mattingService.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

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

      if (!file.buffer || file.buffer.length === 0) {
        res.status(400).json({ error: 'Bad Request', message: '图片数据为空' })
        return
      }

      if (file.buffer.length < 12) {
        res.status(400).json({ error: 'Bad Request', message: '图片数据不完整' })
        return
      }

      const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
      for (let i = 0; i < pngSignature.length; i++) {
        if (file.buffer[i] !== pngSignature[i]) {
          res.status(400).json({ error: 'Bad Request', message: '非 PNG 格式的图片' })
          return
        }
      }

      const iendSig = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]
      const endSlice = file.buffer.slice(file.buffer.length - 8, file.buffer.length)
      for (let i = 0; i < iendSig.length; i++) {
        if (endSlice[i] !== iendSig[i]) {
          res.status(400).json({ error: 'Bad Request', message: 'PNG 图片数据不完整（缺少 IEND 块）' })
          return
        }
      }

      if (file.buffer.length > 200) {
        const ihdrStart = 8
        const ihdrLen =
          (file.buffer[ihdrStart] << 24) |
          (file.buffer[ihdrStart + 1] << 16) |
          (file.buffer[ihdrStart + 2] << 8) |
          file.buffer[ihdrStart + 3]
        if (ihdrLen !== 13) {
          res.status(400).json({ error: 'Bad Request', message: 'PNG 图片结构异常（无效 IHDR）' })
          return
        }
      }

      const resultBuffer = await mattingService.processImage(file.buffer)

      if (!resultBuffer || resultBuffer.length === 0) {
        res.status(500).json({ error: 'Matting Failed', message: '抠图结果为空' })
        return
      }

      for (let i = 0; i < pngSignature.length; i++) {
        if (resultBuffer[i] !== pngSignature[i]) {
          res.status(500).json({ error: 'Matting Failed', message: '抠图结果生成失败' })
          return
        }
      }
      const rEndSlice = resultBuffer.slice(resultBuffer.length - 8, resultBuffer.length)
      for (let i = 0; i < iendSig.length; i++) {
        if (rEndSlice[i] !== iendSig[i]) {
          res.status(500).json({ error: 'Matting Failed', message: '抠图结果生成不完整' })
          return
        }
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

router.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    onnxReady: false,
  })
})

export default router
