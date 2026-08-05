#!/usr/bin/env node
/**
 * Resize roam_logo.png to all required icon sizes across the project
 * Run: node scripts/resize-logo.js
 */

const fs = require('fs');
const path = require('path');

// Try using sharp if available, otherwise fall back to instructions
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.error('ERROR: sharp module not found. Install it first:');
  console.error('  npm install --save-dev sharp');
  process.exit(1);
}

const sourceImage = path.join(__dirname, '../assets/roam_logo.png');
const iconSizes = [
  // Extension icons
  { size: 16, dest: 'extension/icons/icon-16.png' },
  { size: 32, dest: 'extension/icons/icon-32.png' },
  { size: 48, dest: 'extension/icons/icon-48.png' },
  { size: 128, dest: 'extension/icons/icon-128.png' },
  // Web public icons
  { size: 16, dest: 'web/public/icon-16.png' },
  { size: 32, dest: 'web/public/icon-32.png' },
  { size: 512, dest: 'web/public/icon-512.png' },
  { size: 1024, dest: 'web/public/icon-1024.png' },
  { size: 180, dest: 'web/public/apple-touch-icon.png' },
  // Android icons
  { size: 48, dest: 'android/res/icon-48.png' },
  { size: 72, dest: 'android/res/icon-72.png' },
  { size: 96, dest: 'android/res/icon-96.png' },
  { size: 144, dest: 'android/res/icon-144.png' },
  { size: 192, dest: 'android/res/icon-192.png' },
  { size: 512, dest: 'android/res/icon-512.png' },
];

async function resizeIcons() {
  try {
    console.log(`Reading source: ${sourceImage}`);
    const buffer = fs.readFileSync(sourceImage);
    
    for (const icon of iconSizes) {
      const destPath = path.join(__dirname, '../', icon.dest);
      const destDir = path.dirname(destPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      console.log(`Creating ${icon.size}x${icon.size} → ${icon.dest}`);
      await sharp(buffer)
        .resize(icon.size, icon.size, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toFile(destPath);
    }
    
    console.log('\n✓ All icons resized successfully!');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

resizeIcons();
