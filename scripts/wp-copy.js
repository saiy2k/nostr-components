#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const sourceDir = './dist/components';
const assetsDir = './dist/assets';
const targetDir = './nostr-components-by-saiy2k/assets';

// Component files to copy (only the ones we support)
const components = [
    'nostr-post',
    'nostr-profile', 
    'nostr-profile-badge',
    'nostr-follow-button',
    'nostr-zap',
    'nostr-like'
];

console.log('🚀 Starting WordPress plugin build...');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`📁 Created directory: ${targetDir}`);
}

// Generate manifest
const manifest = {
    version: Date.now(),
    buildTime: new Date().toISOString(),
    components: {}
};

// Copy component files
let copiedFiles = 0;
let totalSize = 0;

console.log('📦 Copying component files...');
for (const component of components) {
    const sourceFile = path.join(sourceDir, `${component}.es.js`);
    const targetFile = path.join(targetDir, `${component}.es.js`);
    
    if (fs.existsSync(sourceFile)) {
        // Copy the file
        fs.copyFileSync(sourceFile, targetFile);
        
        // Get file stats
        const stats = fs.statSync(targetFile);
        const fileSize = stats.size;
        totalSize += fileSize;
        
        // Generate hash for integrity
        const fileContent = fs.readFileSync(targetFile);
        const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
        
        // Add to manifest
        manifest.components[component] = {
            file: `${component}.es.js`,
            size: fileSize,
            hash: hash,
            url: `assets/${component}.es.js`
        };
        
        console.log(`✅ Copied: ${component}.es.js (${formatBytes(fileSize)})`);
        copiedFiles++;
    } else {
        console.warn(`⚠️  File not found: ${sourceFile}`);
    }
}

// Copy shared dependencies
console.log('🔗 Copying shared dependencies...');
if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    const jsFiles = assetFiles.filter(file => file.endsWith('.js') && !file.endsWith('.map'));
    
    for (const file of jsFiles) {
        const sourceFile = path.join(assetsDir, file);
        const targetFile = path.join(targetDir, file);
        
        // Copy the file
        fs.copyFileSync(sourceFile, targetFile);
        
        // Get file stats
        const stats = fs.statSync(targetFile);
        const fileSize = stats.size;
        totalSize += fileSize;
        
        console.log(`✅ Copied: assets/${file} (${formatBytes(fileSize)})`);
        copiedFiles++;
    }
} else {
    console.warn(`⚠️  Assets directory not found: ${assetsDir}`);
}

// Copy themes.css
console.log('🎨 Copying themes CSS...');
const themesCssSource = './dist/themes.css';
const themesCssTarget = path.join(targetDir, 'themes.css');

if (fs.existsSync(themesCssSource)) {
    fs.copyFileSync(themesCssSource, themesCssTarget);
    const stats = fs.statSync(themesCssTarget);
    const fileSize = stats.size;
    totalSize += fileSize;
    console.log(`✅ Copied: themes.css (${formatBytes(fileSize)})`);
    copiedFiles++;
} else {
    console.warn(`⚠️  themes.css not found. Run 'npm run build:themes' first.`);
}

// Copy individual theme files
const themesDir = './dist/themes';
const targetThemesDir = path.join(targetDir, 'themes');

if (fs.existsSync(themesDir)) {
    // Ensure target themes directory exists
    if (!fs.existsSync(targetThemesDir)) {
        fs.mkdirSync(targetThemesDir, { recursive: true });
    }
    
    const themeFiles = fs.readdirSync(themesDir).filter(file => file.endsWith('.css'));
    
    for (const file of themeFiles) {
        const sourceFile = path.join(themesDir, file);
        const targetFile = path.join(targetThemesDir, file);
        
        fs.copyFileSync(sourceFile, targetFile);
        const stats = fs.statSync(targetFile);
        const fileSize = stats.size;
        totalSize += fileSize;
        
        console.log(`✅ Copied: themes/${file} (${formatBytes(fileSize)})`);
        copiedFiles++;
    }
} else {
    console.warn(`⚠️  themes directory not found.`);
}

// Write manifest.json
const manifestPath = path.join(targetDir, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`📄 Created manifest.json`);

// Summary
console.log('\n📊 Build Summary:');
const componentCopies = Object.keys(manifest.components).length;
const assetCopies = copiedFiles - componentCopies;
console.log(`   Component files: ${componentCopies}/${components.length}`);
console.log(`   Asset files: ${assetCopies}`);
console.log(`   Total size: ${formatBytes(totalSize)}`);
console.log(`   Target directory: ${targetDir}`);
console.log(`   Manifest: ${manifestPath}`);

// Verify files exist
console.log('\n🔍 Verification:');
for (const component of components) {
    const filePath = path.join(targetDir, `${component}.es.js`);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${component}.es.js`);
    } else {
        console.log(`   ❌ ${component}.es.js (missing)`);
    }
}

console.log('\n🎉 WordPress plugin build complete!');
console.log('   You can now install the plugin from: nostr-components-by-saiy2k/');

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
