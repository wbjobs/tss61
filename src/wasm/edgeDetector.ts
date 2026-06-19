export class EdgeDetector {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      new URL('../workers/edgeDetection.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }

  detect(
    imageData: ImageData,
    threshold: number,
  ): Promise<{ edgeMap: Uint8ClampedArray; edgeRgba: Uint8ClampedArray }> {
    return new Promise((resolve, reject) => {
      const buffer = imageData.data.buffer.slice(0);

      const onMessage = (event: MessageEvent) => {
        if (event.data.type === 'result') {
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          resolve({
            edgeMap: event.data.edgeMap,
            edgeRgba: event.data.edgeRgba,
          });
        }
      };

      const onError = (err: ErrorEvent) => {
        this.worker.removeEventListener('message', onMessage);
        this.worker.removeEventListener('error', onError);
        reject(err);
      };

      this.worker.addEventListener('message', onMessage);
      this.worker.addEventListener('error', onError);

      this.worker.postMessage(
        {
          type: 'detect',
          imageData: new Uint8Array(buffer),
          width: imageData.width,
          height: imageData.height,
          threshold,
        },
        [buffer],
      );
    });
  }

  destroy(): void {
    this.worker.terminate();
  }
}
