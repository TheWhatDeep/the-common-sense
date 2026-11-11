// Renders the PWA icons from SVG with the preinstalled Chromium. Run: npm run icons
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/icons');

// Four rising bars in the pillar colors, on white (the in-app brand mark).
const COLORS = ['#0e9f8e', '#6d4ae0', '#f0645a', '#2f6fe4'];
const HEIGHTS = [0.55, 0.8, 1, 0.7];
const mark = () =>
  COLORS.map((c, i) => {
    const w = 7, gap = 4, total = 4 * w + 3 * gap, x = 32 - total / 2 + i * (w + gap);
    const h = 30 * HEIGHTS[i], y = 47 - h;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.5" fill="${c}"/>`;
  }).join('');

const icons = [
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 1 },
  // Maskable: full-bleed background, mark inside the 80% safe zone.
  { file: 'maskable-512.png', size: 512, rounded: false, scale: 0.7 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const i of icons) {
  const t = 32 - 32 * i.scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${i.size}" height="${i.size}" viewBox="0 0 64 64">
    <rect width="64" height="64" ${i.rounded ? 'rx="14"' : ''} fill="#ffffff"/>
    <g transform="translate(${t} ${t}) scale(${i.scale})">${mark()}</g></svg>`;
  await page.setViewportSize({ width: i.size, height: i.size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`);
  await page.screenshot({ path: join(out, i.file), omitBackground: true });
  console.log('wrote', i.file);
  if (i.file === 'icon-192.png') writeFileSync(join(out, 'favicon.svg'), svg.replace(/width="\d+" height="\d+" /, ''));
}
await browser.close();
