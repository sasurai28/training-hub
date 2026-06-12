// 依存ゼロの PNG アイコン生成（Node 18.18+ の zlib.crc32 / deflateSync を使用）
// 「達成リング」をモチーフにした、ダーク背景＋アクセントの進捗リング。
// 通常アイコンとマスカブルを兼ねるため全面塗り＋中央寄せ。
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import zlib from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public')

const BG = [0x0e, 0x0f, 0x13]
const ACCENT = [0xff, 0x7a, 0x1a]

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function pixel(x, y, S) {
  const c = (S - 1) / 2
  const dx = x - c
  const dy = y - c
  const dist = Math.hypot(dx, dy)
  const rOuter = S * 0.345
  const rInner = S * 0.235
  const aa = S * 0.012
  // リング本体（内外エッジを AA）
  let cov = smoothstep(rInner - aa, rInner + aa, dist) * (1 - smoothstep(rOuter - aa, rOuter + aa, dist))
  // 上部に進捗リング風の隙間
  let ang = Math.atan2(dy, dx) // -PI..PI, 0 = 右, -PI/2 = 上
  const gapCenter = -Math.PI / 2
  let d = Math.abs(ang - gapCenter)
  if (d > Math.PI) d = 2 * Math.PI - d
  const gapHalf = 0.28
  const gapMask = smoothstep(gapHalf - 0.06, gapHalf + 0.06, d)
  cov *= gapMask
  const r = Math.round(BG[0] + (ACCENT[0] - BG[0]) * cov)
  const g = Math.round(BG[1] + (ACCENT[1] - BG[1]) * cov)
  const b = Math.round(BG[2] + (ACCENT[2] - BG[2]) * cov)
  return [r, g, b, 255]
}

function buildPNG(S) {
  // フィルタバイト(0)付きの生スキャンライン
  const raw = Buffer.alloc(S * (S * 4 + 1))
  let o = 0
  for (let y = 0; y < S; y++) {
    raw[o++] = 0
    for (let x = 0; x < S; x++) {
      const [r, g, b, a] = pixel(x, y, S)
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 })

  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const body = Buffer.concat([typeBuf, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0)
    return Buffer.concat([len, body, crc])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(join(OUT, name), buildPNG(size))
  console.log('wrote', name, size)
}
