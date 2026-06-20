import { PNG } from 'pngjs'
import PQueue from 'p-queue'

class MattingService {
  onnxReady = false
  private queue: PQueue

  constructor() {
    this.queue = new PQueue({ concurrency: 4 })
  }

  get isOnnxReady(): boolean {
    return this.onnxReady
  }

  async processImage(imageBuffer: Buffer): Promise<Buffer> {
    const png = PNG.sync.read(imageBuffer)
    const { width, height, data } = png

    const pixelCount = width * height
    const alpha = new Float32Array(pixelCount)

    const borderBrightness: number[] = []
    const borderColors: number[][] = []

    for (let x = 0; x < width; x++) {
      collectBorder(x, 0)
      collectBorder(x, height - 1)
    }
    for (let y = 1; y < height - 1; y++) {
      collectBorder(0, y)
      collectBorder(width - 1, y)
    }

    const avgBorderBrightness =
      borderBrightness.reduce((s, b) => s + b, 0) / borderBrightness.length

    const avgR = borderColors.reduce((s, c) => s + c[0], 0) / borderColors.length
    const avgG = borderColors.reduce((s, c) => s + c[1], 0) / borderColors.length
    const avgB = borderColors.reduce((s, c) => s + c[2], 0) / borderColors.length

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        const dr = r - avgR
        const dg = g - avgG
        const db = b - avgB
        const colorDist = Math.sqrt(dr * dr + dg * dg + db * db)

        const brightness = 0.299 * r + 0.587 * g + 0.114 * b
        const brightDist = Math.abs(brightness - avgBorderBrightness)

        const combinedDist = colorDist * 0.7 + brightDist * 0.3
        const threshold = 60
        const spread = 40
        const a = Math.min(1, Math.max(0, (combinedDist - threshold + spread) / (spread * 2)))
        alpha[y * width + x] = a
      }
    }

    const smoothed = gaussianSmooth(alpha, width, height, 3)

    const outPng = new PNG({ width, height })
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        outPng.data[idx] = data[idx]
        outPng.data[idx + 1] = data[idx + 1]
        outPng.data[idx + 2] = data[idx + 2]
        outPng.data[idx + 3] = Math.round(smoothed[y * width + x] * 255)
      }
    }

    return PNG.sync.write(outPng)

    function collectBorder(x: number, y: number) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      borderBrightness.push(0.299 * r + 0.587 * g + 0.114 * b)
      borderColors.push([r, g, b])
    }
  }

  async processImageConcurrent(imageBuffer: Buffer): Promise<Buffer> {
    return this.queue.add(() => this.processImage(imageBuffer))
  }

  getQueueStatus(): { pending: number; active: number; concurrency: number } {
    return {
      pending: this.queue.pending,
      active: this.queue.size,
      concurrency: this.queue.concurrency,
    }
  }
}

function gaussianSmooth(
  alpha: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const result = new Float32Array(alpha.length)
  const kernelSize = radius * 2 + 1
  const sigma = radius / 2
  const kernel = new Float32Array(kernelSize)
  let kernelSum = 0

  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel[i + radius] = val
    kernelSum += val
  }
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= kernelSum
  }

  const temp = new Float32Array(alpha.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const nx = Math.min(width - 1, Math.max(0, x + k))
        sum += alpha[y * width + nx] * kernel[k + radius]
      }
      temp[y * width + x] = sum
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const ny = Math.min(height - 1, Math.max(0, y + k))
        sum += temp[ny * width + x] * kernel[k + radius]
      }
      result[y * width + x] = sum
    }
  }

  return result
}

export const mattingService = new MattingService()
