export class EdgeDetector {
  private worker: Worker;
  private readonly MAX_EDGE_WIDTH = 1024;
  private readonly MAX_EDGE_HEIGHT = 1024;

  constructor() {
    this.worker = new Worker(
      new URL('../workers/edgeDetection.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }

  private downsampleForEdgeDetect(
    src: ImageData,
  ): { data: Uint8Array; width: number; height: number; scaleX: number; scaleY: number } {
    const srcW = src.width;
    const srcH = src.height;

    if (srcW <= this.MAX_EDGE_WIDTH && srcH <= this.MAX_EDGE_HEIGHT) {
      return {
        data: new Uint8Array(src.data.buffer.slice(0)),
        width: srcW,
        height: srcH,
        scaleX: 1,
        scaleY: 1,
      };
    }

    const scale = Math.min(this.MAX_EDGE_WIDTH / srcW, this.MAX_EDGE_HEIGHT / srcH, 1);
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const offscreen = document.createElement('canvas');
    offscreen.width = dstW;
    offscreen.height = dstH;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true })!;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = srcW;
    tmpCanvas.height = srcH;
    const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true })!;
    const tmpImg = tmpCtx.createImageData(srcW, srcH);
    tmpImg.data.set(src.data);
    tmpCtx.putImageData(tmpImg, 0, 0);

    ctx.drawImage(tmpCanvas, 0, 0, dstW, dstH);
    const imgData = ctx.getImageData(0, 0, dstW, dstH);

    return {
      data: new Uint8Array(imgData.data.buffer.slice(0)),
      width: dstW,
      height: dstH,
      scaleX: srcW / dstW,
      scaleY: srcH / dstH,
    };
  }

  private upsampleToOriginal(
    smallRgba: Uint8ClampedArray,
    smallW: number,
    smallH: number,
    targetW: number,
    targetH: number,
  ): Uint8ClampedArray {
    if (smallW === targetW && smallH === targetH) {
      return new Uint8ClampedArray(smallRgba.buffer.slice(0));
    }

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = smallW;
    srcCanvas.height = smallH;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
    const srcImg = srcCtx.createImageData(smallW, smallH);
    srcImg.data.set(smallRgba);
    srcCtx.putImageData(srcImg, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = targetW;
    dstCanvas.height = targetH;
    const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })!;
    dstCtx.imageSmoothingEnabled = true;
    dstCtx.imageSmoothingQuality = 'medium';
    dstCtx.drawImage(srcCanvas, 0, 0, targetW, targetH);

    const result = dstCtx.getImageData(0, 0, targetW, targetH);
    return new Uint8ClampedArray(result.data.buffer.slice(0));
  }

  detect(
    imageData: ImageData,
    threshold: number,
  ): Promise<{ edgeMap: Uint8ClampedArray; edgeRgba: Uint8ClampedArray }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.worker.terminate();
        reject(new Error('边缘检测超时，图片可能过大'));
      }, 30000);

      const { data, width, height, scaleX, scaleY } = this.downsampleForEdgeDetect(imageData);
      const originalW = imageData.width;
      const originalH = imageData.height;

      const onMessage = (event: MessageEvent) => {
        if (event.data.type === 'result') {
          clearTimeout(timeoutId);
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);

          const upscaledRgba = this.upsampleToOriginal(
            event.data.edgeRgba,
            event.data.width,
            event.data.height,
            originalW,
            originalH,
          );

          const edgeMap = new Uint8ClampedArray(originalW * originalH);
          for (let i = 0, j = 0; i < upscaledRgba.length; i += 4, j++) {
            if (upscaledRgba[i + 3] > 0) {
              edgeMap[j] = 255;
            }
          }

          resolve({ edgeMap, edgeRgba: upscaledRgba });
        } else if (event.data.type === 'error') {
          clearTimeout(timeoutId);
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          reject(new Error(event.data.message || '边缘检测失败'));
        }
      };

      const onError = (err: ErrorEvent) => {
        clearTimeout(timeoutId);
        this.worker.removeEventListener('message', onMessage);
        this.worker.removeEventListener('error', onError);
        reject(err);
      };

      this.worker.addEventListener('message', onMessage);
      this.worker.addEventListener('error', onError);

      const buffer = data.buffer;
      this.worker.postMessage(
        {
          type: 'detect',
          imageData: data,
          width,
          height,
          threshold,
          scaleX,
          scaleY,
        },
        [buffer],
      );
    });
  }

  destroy(): void {
    this.worker.terminate();
  }
}
