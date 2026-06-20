import { PNG } from 'pngjs'
import { readFileSync } from 'fs'

function createPng(w, h, r, g, b) {
  const png = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const inside = x > w * 0.2 && x < w * 0.8 && y > h * 0.15 && y < h * 0.85
      png.data[idx] = inside ? r : 230
      png.data[idx + 1] = inside ? g : 230
      png.data[idx + 2] = inside ? b : 235
      png.data[idx + 3] = 255
    }
  }
  return PNG.sync.write(png)
}

const fd = new FormData()
const colors = [
  [200, 60, 60],
  [60, 150, 60],
  [60, 100, 200],
  [200, 150, 50],
  [150, 60, 180],
]
for (let i = 0; i < 5; i++) {
  const [r, g, b] = colors[i]
  const pngBuf = createPng(300 + i * 50, 200 + i * 30, r, g, b)
  const blob = new Blob([pngBuf], { type: 'image/png' })
  fd.append('image', blob, `img-${i + 1}.png`)
}

console.log('Sending 5 images to /api/matting/batch ...')
const t0 = Date.now()

const res = await fetch('http://localhost:3001/api/matting/batch', {
  method: 'POST',
  body: fd,
})

const dt = Date.now() - t0
console.log(`Status: ${res.status} ${res.statusText} (${dt}ms)`)
console.log('Content-Type:', res.headers.get('content-type'))

if (res.ok) {
  const data = await res.json()
  console.log(`\nResults: ${data.results.length} images`)
  let success = 0, fail = 0
  for (const r of data.results) {
    if (r.status === 'success') {
      success++
      const buf = Buffer.from(r.buffer, 'base64')
      const ok = buf.slice(0, 8).every((v, i) => v === [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A][i])
      console.log(`  ${r.id.slice(0, 8)}: success, ${buf.length} bytes, PNG valid: ${ok}`)
    } else {
      fail++
      console.log(`  ${r.id.slice(0, 8)}: ERROR - ${r.error}`)
    }
  }
  console.log(`\nTotal: ${success} success, ${fail} failed`)
} else {
  const err = await res.json()
  console.error('Error:', err)
}
