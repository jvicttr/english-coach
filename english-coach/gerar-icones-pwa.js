const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// SVG do logo JV — quadrado amarelo com bordas arredondadas + texto JV preto
function svgIcon(size) {
  const radius = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.44);
  const y = Math.round(size * 0.655);
  return Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#F5C800"/>
  <text
    x="${size / 2}"
    y="${y}"
    font-family="Arial Black, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="900"
    text-anchor="middle"
    fill="#000000"
  >JV</text>
</svg>`);
}

async function generate() {
  const sizes = [192, 512];
  for (const size of sizes) {
    const outPath = path.join(publicDir, `icon-${size}.png`);
    await sharp(svgIcon(size), { density: 300 })
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ icon-${size}.png gerado`);
  }

  // Apple touch icon (180x180)
  const applePath = path.join(publicDir, "apple-touch-icon.png");
  await sharp(svgIcon(180), { density: 300 })
    .resize(180, 180)
    .png()
    .toFile(applePath);
  console.log("✅ apple-touch-icon.png gerado");
}

generate().catch(console.error);
