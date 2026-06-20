// Wasm 模块占位文件 —— 当 Wasm 尚未编译时，此文件提供空实现
// Worker 会检测 detect_edges_to_rgba 是否存在，不存在则自动回退到纯 JS 实现
//
// 编译真实 Wasm:
//   cd wasm-edge-detect
//   wasm-pack build --release --target web
// 然后将 pkg/ 下的文件复制到 public/wasm-edge-detect/
// 并修改 edgeDetection.worker.ts 中的加载路径

export async function initialize(): Promise<void> {
  // stub: no-op
}

export default {
  initialize,
}
