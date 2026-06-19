let wasmInstance: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const wasmModule = await import('/wasm-edge-detect/edge_detect.js');
  if (wasmModule?.default?.initialize) {
    await wasmModule.default.initialize();
    wasmInstance = wasmModule.default;
  }
} catch {
  wasmInstance = null;
}

const Gx = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

const Gy = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

function sobelEdgeDetection(
  data: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): { edgeMap: Uint8ClampedArray; edgeRgba: Uint8ClampedArray } {
  const edgeMap = new Uint8ClampedArray(width * height);
  const edgeRgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sumGx = 0;
      let sumGy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
          const gray =
            data[pixelIdx] * 0.299 +
            data[pixelIdx + 1] * 0.587 +
            data[pixelIdx + 2] * 0.114;
          sumGx += gray * Gx[ky + 1][kx + 1];
          sumGy += gray * Gy[ky + 1][kx + 1];
        }
      }

      const magnitude = Math.sqrt(sumGx * sumGx + sumGy * sumGy);
      const idx = y * width + x;
      const rgbaIdx = idx * 4;

      if (magnitude >= threshold) {
        edgeMap[idx] = 255;
        edgeRgba[rgbaIdx] = 0x00;
        edgeRgba[rgbaIdx + 1] = 0xe5;
        edgeRgba[rgbaIdx + 2] = 0xcc;
        edgeRgba[rgbaIdx + 3] = 180;
      } else {
        edgeMap[idx] = 0;
        edgeRgba[rgbaIdx] = 0;
        edgeRgba[rgbaIdx + 1] = 0;
        edgeRgba[rgbaIdx + 2] = 0;
        edgeRgba[rgbaIdx + 3] = 0;
      }
    }
  }

  return { edgeMap, edgeRgba };
}

declare const self: {
  onmessage: ((ev: MessageEvent) => void) | null;
  postMessage: (message: any, options?: StructuredSerializeOptions) => void;
};

interface StructuredSerializeOptions {
  transfer?: Transferable[];
}

export {};

self.onmessage = (event: MessageEvent) => {
  const { type, imageData, width, height, threshold } = event.data;

  if (type !== 'detect') return;

  if (wasmInstance && typeof wasmInstance.detect === 'function') {
    try {
      const result = wasmInstance.detect(imageData, width, height, threshold);
      self.postMessage(
        { type: 'result', edgeMap: result.edgeMap, edgeRgba: result.edgeRgba, width, height },
        { transfer: [result.edgeMap.buffer, result.edgeRgba.buffer] },
      );
      return;
    } catch {
      // fall through to JS implementation
    }
  }

  const { edgeMap, edgeRgba } = sobelEdgeDetection(imageData, width, height, threshold);
  self.postMessage(
    { type: 'result', edgeMap, edgeRgba, width, height },
    { transfer: [edgeMap.buffer, edgeRgba.buffer] },
  );
};
