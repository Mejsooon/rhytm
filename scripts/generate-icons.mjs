// Generuje ikony PWA (ciemny zaokrąglony kwadrat + znak 3×3): node scripts/generate-icons.mjs
import sharp from "sharp";

const cells = [
  "#EF8A55", "#F9A782", "#FFDBCA",
  "#DF6C32", "#EF8A55", "#F9A782",
  "#7C350E", "#B64E10", "#DF6C32",
];
const rects = cells
  .map((fill, i) => `<rect x="${22 + (i % 3) * 34}" y="${22 + Math.floor(i / 3) * 34}" width="28" height="28" rx="7" fill="${fill}"/>`)
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><rect width="140" height="140" rx="30" fill="#191816"/>${rects}</svg>`;

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}
