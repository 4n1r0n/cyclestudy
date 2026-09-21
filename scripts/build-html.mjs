import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(root, '../dist')
const htmlPath = path.join(dist, 'index.html')

if (!existsSync(htmlPath)) {
  throw new Error('dist/index.html missing. Run vite build first.')
}

function readAsset(urlPath) {
  const cleaned = urlPath.replace(/^\.\//, '').replace(/^\//, '')
  const file = path.join(dist, cleaned)
  if (!existsSync(file)) throw new Error(`Missing asset ${file} (from ${urlPath})`)
  return readFileSync(file, 'utf8')
}

let html = readFileSync(htmlPath, 'utf8')

html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '')

html = html.replace(/<link rel="icon"[^>]*>\s*/g, () => {
  const svg = readFileSync(path.resolve(root, '../public/favicon.svg'), 'utf8')
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`
  return `<link rel="icon" type="image/svg+xml" href="${href}" />\n    `
})

html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_all, href) => {
  return `<style>\n${readAsset(href)}\n</style>`
})

html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_all, src) => {
  return `<script type="module">\n${readAsset(src)}\n</script>`
})

if (/src="[^"]+\.js"/.test(html) || /href="[^"]+\.css"/.test(html)) {
  throw new Error('CycleStudy.html still references external JS/CSS after inlining.')
}

const outDist = path.join(dist, 'CycleStudy.html')
const outRoot = path.resolve(root, '../CycleStudy.html')
writeFileSync(outDist, html)
writeFileSync(outRoot, html)
console.log(`Wrote ${outRoot} (${Buffer.byteLength(html)} bytes)`)
