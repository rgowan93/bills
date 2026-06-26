import zlib from 'node:zlib'
import fs from 'node:fs'

// Minimal PNG encoder (truecolor + alpha) drawing the WealthOS app icon:
// a deep gradient tile with three ascending "growth" bars + spark.

function lerp(a, b, t) { return a + (b - a) * t }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)] }

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4)
  const A = [124, 92, 255]   // accent purple
  const B = [0, 224, 198]    // teal
  const D = [10, 8, 22]      // deep bg
  const radius = size * 0.235
  const white = [255, 255, 255]

  const inRoundRect = (x, y, rx, ry, w, h, r) => {
    const dx = Math.max(rx - x, x - (rx + w), 0)
    const dy = Math.max(ry - y, y - (ry + h), 0)
    if (x > rx + r && x < rx + w - r) return y >= ry && y <= ry + h
    if (y > ry + r && y < ry + h - r) return x >= rx && x <= rx + w
    // corners
    const cx = x < rx + r ? rx + r : rx + w - r
    const cy = y < ry + r ? ry + r : ry + h - r
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= rx && x <= rx + w && y >= ry && y <= ry + h
  }

  // bars geometry
  const barW = size * 0.13
  const gap = size * 0.075
  const groupW = barW * 3 + gap * 2
  const startX = (size - groupW) / 2
  const baseY = size * 0.74
  const heights = [0.20, 0.32, 0.46]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // tile mask (rounded square with margin)
      const m = size * 0.06
      const inside = inRoundRect(x, y, m, m, size - 2 * m, size - 2 * m, radius)
      if (!inside) { buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0; continue }
      // diagonal gradient
      const t = (x + y) / (2 * size)
      let col = mix(mix(A, D, 0.15), B, Math.min(1, t * 1.1))
      col = mix(D, col, 0.92)

      // bars
      for (let b = 0; b < 3; b++) {
        const bx = startX + b * (barW + gap)
        const bh = size * heights[b]
        if (x >= bx && x <= bx + barW && y >= baseY - bh && y <= baseY) {
          const g = (y - (baseY - bh)) / bh
          col = mix(white, mix(white, B, 0.5), g)
        }
      }
      buf[i] = Math.round(col[0]); buf[i + 1] = Math.round(col[1]); buf[i + 2] = Math.round(col[2]); buf[i + 3] = 255
    }
  }
  return buf
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

fs.mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  fs.writeFileSync(`public/icons/icon-${size}.png`, encodePNG(size, drawIcon(size)))
  console.log(`wrote public/icons/icon-${size}.png`)
}
