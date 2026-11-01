const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const src = 'C:/Users/ASUS/.gemini/antigravity/brain/a9d9ab7f-d246-48ef-8144-bc9b310c05fc/.user_uploaded/media_1793554372984_2f9ae8b1.jpg';

  if (!fs.existsSync(src)) {
    console.error('Source image not found at:', src);
    process.exit(1);
  }

  // Ensure directories exist
  fs.mkdirSync('public', { recursive: true });
  fs.mkdirSync('app', { recursive: true });

  // 1. Extract the squircle (bounds: left 56, top 53, width 912, height 912)
  const squircle = await sharp(src)
    .extract({ left: 56, top: 53, width: 912, height: 912 })
    .toBuffer();

  // 2. Create high-precision squircle mask with transparent outer corners
  // Corner radius is ~204px on 912px (standard Apple squircle ~22.37%)
  const maskSvg = `
    <svg width="912" height="912" viewBox="0 0 912 912" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="912" height="912" rx="204" ry="204" fill="#ffffff" />
    </svg>
  `;

  const maskedSquircle = await sharp(squircle)
    .composite([
      {
        input: Buffer.from(maskSvg),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  // Also create a version without corner clipping for places that prefer full square
  const fullSquircle = await sharp(squircle)
    .png()
    .toBuffer();

  // Save assets
  // 1. public/logo.png (512x512)
  await sharp(maskedSquircle)
    .resize(512, 512, { fit: 'contain' })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile('public/logo.png');

  // 2. public/praxd-logo.png
  await sharp(maskedSquircle)
    .resize(512, 512, { fit: 'contain' })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile('public/praxd-logo.png');

  // 3. public/logo-full.png
  await sharp(fullSquircle)
    .resize(512, 512, { fit: 'contain' })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile('public/logo-full.png');

  // 4. app/icon.png (Next.js automatically uses this for favicon link rel="icon")
  await sharp(maskedSquircle)
    .resize(512, 512, { fit: 'contain' })
    .png({ quality: 100 })
    .toFile('app/icon.png');

  // 5. app/apple-icon.png (Apple touch icon 180x180)
  await sharp(maskedSquircle)
    .resize(180, 180, { fit: 'contain' })
    .png({ quality: 100 })
    .toFile('app/apple-icon.png');

  // 6. Favicons
  await sharp(maskedSquircle)
    .resize(32, 32, { fit: 'contain' })
    .png()
    .toFile('public/favicon.ico');

  await sharp(maskedSquircle)
    .resize(32, 32, { fit: 'contain' })
    .png()
    .toFile('app/favicon.ico');

  console.log('Successfully generated all logo assets!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
