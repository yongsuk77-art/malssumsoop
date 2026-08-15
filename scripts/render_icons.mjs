import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "icon.svg");

await Promise.all([
  sharp(source).resize(192, 192).png().toFile(path.join(root, "public", "icon-192.png")),
  sharp(source).resize(512, 512).png().toFile(path.join(root, "public", "icon-512.png")),
  sharp(source).resize(180, 180).png().toFile(path.join(root, "public", "apple-touch-icon.png")),
]);

console.log("Rendered PWA icons.");
