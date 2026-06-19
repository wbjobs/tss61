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

      const resultBuffer = await mattingService.processImage(file.buffer)

      res.setHeader('Content-Type', 'image/png')
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
