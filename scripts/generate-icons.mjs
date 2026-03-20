import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '..', 'public', 'icons')

// SVG with white background and the ChemWeed leaf+CW logo
// Brand green: #2a6b2a
function makeSvg(size) {
  const fontSize = Math.round(size * 0.32)
  const leafSize = Math.round(size * 0.18)
  const leafY = Math.round(size * 0.22)
  const textY = Math.round(size * 0.62)
  const subFontSize = Math.round(size * 0.09)
  const subY = Math.round(size * 0.76)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="white" rx="${Math.round(size * 0.08)}"/>
  <!-- Leaf icon -->
  <g transform="translate(${size / 2 - leafSize / 2}, ${leafY})">
    <path d="M${leafSize / 2} 0 C${leafSize * 0.85} ${leafSize * 0.1} ${leafSize} ${leafSize * 0.5} ${leafSize} ${leafSize} C${leafSize * 0.65} ${leafSize * 0.85} ${leafSize / 2} ${leafSize * 0.95} ${leafSize / 2} ${leafSize * 0.95} C${leafSize / 2} ${leafSize * 0.95} ${leafSize * 0.35} ${leafSize * 0.85} 0 ${leafSize} C0 ${leafSize * 0.5} ${leafSize * 0.15} ${leafSize * 0.1} ${leafSize / 2} 0Z" fill="#2a6b2a"/>
    <line x1="${leafSize * 0.2}" y1="${leafSize * 0.8}" x2="${leafSize * 0.8}" y2="${leafSize * 0.2}" stroke="white" stroke-width="${leafSize * 0.06}" stroke-linecap="round"/>
    <line x1="${leafSize * 0.35}" y1="${leafSize * 0.45}" x2="${leafSize * 0.6}" y2="${leafSize * 0.25}" stroke="white" stroke-width="${leafSize * 0.04}" stroke-linecap="round"/>
    <line x1="${leafSize * 0.3}" y1="${leafSize * 0.7}" x2="${leafSize * 0.55}" y2="${leafSize * 0.5}" stroke="white" stroke-width="${leafSize * 0.04}" stroke-linecap="round"/>
  </g>
  <!-- CW text -->
  <text x="${size / 2}" y="${textY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fontSize}" fill="#2a6b2a" letter-spacing="-${Math.round(fontSize * 0.03)}">CW</text>
  <!-- OS subtitle -->
  <text x="${size / 2}" y="${subY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="${subFontSize}" fill="#2a6b2a" opacity="0.6" letter-spacing="${Math.round(subFontSize * 0.15)}">OS</text>
</svg>`
}

async function generate(size, filename) {
  const svg = makeSvg(size)
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, filename))
  console.log(`Generated ${filename} (${size}x${size})`)
}

await generate(192, 'icon-192.png')
await generate(512, 'icon-512.png')
console.log('Done!')
