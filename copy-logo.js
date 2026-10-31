const fs = require('fs');
const path = require('path');

const src = 'C:/Users/ASUS/.gemini/antigravity/brain/a9d9ab7f-d246-48ef-8144-bc9b310c05fc/.user_uploaded/media_1793386753661_5586d722.png';

if (!fs.existsSync(src)) {
  console.error('Source file not found:', src);
  process.exit(1);
}

fs.mkdirSync('public', { recursive: true });

fs.copyFileSync(src, 'public/logo.png');
fs.copyFileSync(src, 'public/praxd-logo.png');
fs.copyFileSync(src, 'app/icon.png');
fs.copyFileSync(src, 'app/apple-icon.png');

console.log('Successfully copied logo files to public and app directories');
