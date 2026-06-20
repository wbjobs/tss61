let wasmInstance: any = null
let wasmLoadAttempted = false

async function loadWasm(): Promise<any> {
  if (wasmLoadAttempted) return wasmInstance
  wasmLoadAttempted = true

  try {
    const wasmModule = await import('@/wasm/wasm-stub')
    if (wasmModule?.default?.initialize) {
      await wasmModule.default.initialize()
      wasmInstance = wasmModule.default
    }
  } catch {
    wasmInstance = null
  }
  return wasmInstance
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
  if (!width || !height || width < 3 || height < 3) {
    return {
      edgeMap: new Uint8ClampedArray(Math.max(0, width * height)),
      edgeRgba: new Uint8ClampedArray(Math.max(0, width * height * 4)),
    };
  }

  const expectedLen = width * height * 4;
  const safeLen = Math.min(data.length, expectedLen);

  const edgeMap = new Uint8ClampedArray(width * height);
  const edgeRgba = new Uint8ClampedArray(width * height * 4);

  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < safeLen; i += 4, p++) {
    gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sumGx = 0;
      let sumGy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        const rowOffset = (y + ky) * width;
        for (let kx = -1; kx <= 1; kx++) {
          const g = gray[rowOffset + x + kx];
          sumGx += g * Gx[ky + 1][kx + 1];
          sumGy += g * Gy[ky + 1][kx + 1];
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

self.onmessage = async (event: MessageEvent) => {
  const { type, imageData, width, height, threshold } = event.data;

  if (type !== 'detect') return;

  try {
    if (!imageData || !width || !height) {
      self.postMessage({ type: 'error', message: '无效的图片数据' });
      return;
    }

    const wasm = await loadWasm();
    if (wasm && typeof wasm.detect_edges_to_rgba === 'function') {
      try {
        const rgba = wasm.detect_edges_to_rgba(
          new Uint8Array(imageData),
          width,
          height,
          threshold,
        );
        const len = width * height;
        const edgeMap = new Uint8ClampedArray(len);
        for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
          if (rgba[i + 3] > 0) edgeMap[j] = 255;
        }
        const transferable: Transferable[] = [];
        if (rgba.buffer instanceof ArrayBuffer) transferable.push(rgba.buffer);
        if (edgeMap.buffer instanceof ArrayBuffer) transferable.push(edgeMap.buffer);
        self.postMessage(
          { type: 'result', edgeMap, edgeRgba: rgba, width, height },
          { transfer: transferable },
        );
        return;
      } catch {
        // fall through to JS implementation
      }
    }

    const { edgeMap, edgeRgba } = sobelEdgeDetection(imageData, width, height, threshold);
    const transferable: Transferable[] = [];
    if (edgeMap.buffer instanceof ArrayBuffer) transferable.push(edgeMap.buffer);
    if (edgeRgba.buffer instanceof ArrayBuffer) transferable.push(edgeRgba.buffer);
    self.postMessage(
      { type: 'result', edgeMap, edgeRgba, width, height },
      { transfer: transferable },
    );
  } catch (e) {
    self.postMessage({
      type: 'error',
      message: e instanceof Error ? e.message : '边缘检测发生未知错误',
    });
  }
};
