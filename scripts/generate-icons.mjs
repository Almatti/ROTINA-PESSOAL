// Gera os ícones PNG do PWA a partir do SVG do monograma usando o Chromium do Playwright.
import { chromium } from "playwright";
import fs from "node:fs";
const svg = (bg, pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9A7BC8"/><stop offset="1" stop-color="#5E3F8F"/></linearGradient></defs>
<rect width="64" height="64" fill="${bg}"/>
<g transform="translate(${pad} ${pad}) scale(${(64 - pad * 2) / 64})">
<path d="M17 18c4 0 6 2 7.5 6L32 42l7.5-18c1.5-4 3.5-6 7.5-6" stroke="url(#g)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<path d="M32 47c-3.2-3.4-3.2-7 0-10 3.2 3 3.2 6.6 0 10Z" fill="#BAAAC8"/></g></svg>`;
const targets = [
  ["icon-192.png", 192, "#F7F4FB", 4],
  ["icon-512.png", 512, "#F7F4FB", 4],
  ["maskable-512.png", 512, "#F7F4FB", 12],
  ["apple-touch-icon.png", 180, "#F7F4FB", 6],
  ["badge-96.png", 96, "#7451A6", 4],
];
fs.mkdirSync("public/icons", { recursive: true });
fs.writeFileSync("public/icons/icon.svg", svg("#F7F4FB", 4));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, bg, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(bg, pad).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false });
}
await browser.close();
console.log("ícones gerados");
