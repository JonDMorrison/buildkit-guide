const { Jimp } = require("jimp");
const fs = require("fs");
const path = require("path");

const ICO_SRC = path.resolve(__dirname, "../public/favicon.ico");
const PNG_TMP = path.resolve(__dirname, "../public/_favicon_src.png");
const OUT     = path.resolve(__dirname, "../public");

const sizes = [
  { name: "favicon-16x16.png",    size: 16  },
  { name: "favicon-32x32.png",    size: 32  },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-192x192.png",  size: 192 },
];

async function run() {
  // The ICO file contains an embedded PNG starting at byte 22
  // (standard single-image ICO header is 6 + 16 = 22 bytes)
  const icoBuffer = fs.readFileSync(ICO_SRC);
  const pngOffset = icoBuffer.readUInt32LE(18); // offset field in ICONDIRENTRY
  const pngBuffer = icoBuffer.slice(pngOffset);
  fs.writeFileSync(PNG_TMP, pngBuffer);
  console.log(`Extracted embedded PNG from favicon.ico (offset ${pngOffset})`);

  const image = await Jimp.read(PNG_TMP);
  console.log(`Source image: ${image.width}x${image.height}`);

  for (const { name, size } of sizes) {
    const dest = path.join(OUT, name);
    await image.clone().resize({ w: size, h: size }).write(dest);
    const stat = fs.statSync(dest);
    console.log(`  ✓ ${name} (${size}x${size}, ${stat.size} bytes)`);
  }

  // Copy 32x32 as favicon.ico
  const icoDest = path.join(OUT, "favicon.ico");
  fs.copyFileSync(path.join(OUT, "favicon-32x32.png"), icoDest);
  console.log(`  ✓ favicon.ico (copied from favicon-32x32.png)`);

  // Clean up temp file
  fs.unlinkSync(PNG_TMP);

  console.log("\nDone. All files written to public/");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
