// Renders the PWA icons from SVG with the preinstalled Chromium. Run: npm run icons
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/icons');

// Four columns under a pediment: the four pillars.
const mark = (stroke) => `
  <g fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 50h36"/><path d="M15 23h34"/><path d="M32 13l17 10H15z"/>
    <path d="M20 29v15"/><path d="M28 29v15"/><path d="M36 29v15"/><path d="M44 29v15"/>
  </g>`;

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
    <rect width="64" height="64" ${i.rounded ? 'rx="14"' : ''} fill="#1E4D45"/>
    <g transform="translate(${t} ${t}) scale(${i.scale})">${mark('#fff')}</g></svg>`;
  await page.setViewportSize({ width: i.size, height: i.size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`);
  await page.screenshot({ path: join(out, i.file), omitBackground: true });
  console.log('wrote', i.file);
}
await browser.close();
