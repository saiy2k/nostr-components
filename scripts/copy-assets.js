#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '../assets');
const targetDir = path.join(__dirname, '../dist/assets');

console.log('📦 Copying assets to dist...');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy all files from assets to dist/assets
if (fs.existsSync(sourceDir)) {
  const files = fs.readdirSync(sourceDir);
  
  files.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`  ✓ Copied ${file}`);
    }
  });
  
  console.log('✅ Assets copied successfully!');
} else {
  console.warn('⚠️  Assets directory not found, skipping...');
}

