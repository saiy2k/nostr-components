#!/usr/bin/env node

/**
 * Release preparation script for WordPress.org submission
 * 
 * This script helps prepare the plugin for WordPress.org submission by:
 * - Validating file structure
 * - Checking for required files
 * - Generating a zip file for submission
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NostrWPReleasePrep {
    constructor(pluginDir = null) {
        this.pluginDir = pluginDir || __dirname;
        this.requiredFiles = [
<<<<<<<< HEAD:saiy2k-nostr-components/prepare-release.js
            'saiy2k-nostr-components.php',
========
            'nostr-components-by-saiy2k.php',
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/prepare-release.js
            'README.txt',
            'LICENSE',
            'changelog.txt',
            'uninstall.php'
        ];
        
        this.requiredDirs = [
            'inc',
            'blocks',
            'assets'
        ];
    }
    
    validate() {
        console.log('🔍 Validating plugin structure...');
        
        const errors = [];
        const warnings = [];
        
        // Check required files
        for (const file of this.requiredFiles) {
            const filePath = path.join(this.pluginDir, file);
            if (!fs.existsSync(filePath)) {
                errors.push(`Missing required file: ${file}`);
            } else {
                console.log(`✅ Found: ${file}`);
            }
        }
        
        // Check required directories
        for (const dir of this.requiredDirs) {
            const dirPath = path.join(this.pluginDir, dir);
            if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
                errors.push(`Missing required directory: ${dir}`);
            } else {
                console.log(`✅ Found directory: ${dir}`);
            }
        }
        
        // Check plugin header
        this.validatePluginHeader();
        
        // Check for screenshots
        const screenshotsDir = path.join(this.pluginDir, 'assets', 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            warnings.push('Screenshots directory not found - consider adding screenshots for WordPress.org');
        } else {
            const screenshots = fs.readdirSync(screenshotsDir).filter(file => 
                /\.(png|jpg|jpeg)$/i.test(file)
            );
            if (screenshots.length === 0) {
                warnings.push('No screenshots found in assets/screenshots/');
            } else {
                console.log(`✅ Found ${screenshots.length} screenshot(s)`);
            }
        }
        
        // Report results
        if (errors.length > 0) {
            console.log('\n❌ ERRORS:');
            errors.forEach(error => console.log(`  - ${error}`));
        }
        
        if (warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        if (errors.length === 0) {
            console.log('\n✅ Plugin structure validation passed!');
            return true;
        }
        
        return false;
    }
    
    validatePluginHeader() {
<<<<<<<< HEAD:saiy2k-nostr-components/prepare-release.js
        const mainFile = path.join(this.pluginDir, 'saiy2k-nostr-components.php');
========
        const mainFile = path.join(this.pluginDir, 'nostr-components-by-saiy2k.php');
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/prepare-release.js
        if (!fs.existsSync(mainFile)) {
            return;
        }
        
        const content = fs.readFileSync(mainFile, 'utf8');
        
        const requiredHeaders = [
            'Plugin Name',
            'Description', 
            'Version',
            'Author',
            'License',
            'Text Domain'
        ];
        
        requiredHeaders.forEach(header => {
            if (content.includes(`${header}:`)) {
                console.log(`✅ Plugin header: ${header}`);
            } else {
                console.log(`⚠️  Missing plugin header: ${header}`);
            }
        });
    }
    
    createZip(outputPath = null) {
        // Extract version from plugin file
<<<<<<<< HEAD:saiy2k-nostr-components/prepare-release.js
        const mainFile = path.join(this.pluginDir, 'saiy2k-nostr-components.php');
        let version = '0.3.0'; // fallback
========
        const mainFile = path.join(this.pluginDir, 'nostr-components-by-saiy2k.php');
        let version = '0.2.0'; // fallback
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/prepare-release.js
        if (fs.existsSync(mainFile)) {
            const content = fs.readFileSync(mainFile, 'utf8');
            const versionMatch = content.match(/Version:\s*([^\r\n]+)/);
            if (versionMatch) {
                version = versionMatch[1].trim();
            }
        }
        
        if (!outputPath) {
<<<<<<<< HEAD:saiy2k-nostr-components/prepare-release.js
            outputPath = path.join(path.dirname(this.pluginDir), `saiy2k-nostr-components-v${version}.zip`);
========
            outputPath = path.join(path.dirname(this.pluginDir), `nostr-components-by-saiy2k-v${version}.zip`);
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/prepare-release.js
        }
        
        console.log('\n📦 Creating release zip...');
        
        try {
            // Use safer approach with proper escaping
            const cwd = path.dirname(this.pluginDir);
            const zipArgs = [
                '-r',
                path.basename(outputPath),
                path.basename(this.pluginDir),
                '-x', '*.DS_Store', '*/node_modules/*', '*/.git/*'
            ];
            execSync('zip', zipArgs, { cwd, stdio: 'inherit' });
            
            const stats = fs.statSync(outputPath);
            console.log(`✅ Created release zip: ${outputPath}`);
            console.log(`📊 Zip size: ${this.formatBytes(stats.size)}`);
            
            return outputPath;
        } catch (error) {
            console.log('❌ Failed to create zip file. Make sure you have the "zip" command available.');
<<<<<<<< HEAD:saiy2k-nostr-components/prepare-release.js
            console.log('💡 Alternative: You can manually zip the saiy2k-nostr-components directory');
========
            console.log('💡 Alternative: You can manually zip the nostr-components-by-saiy2k directory');
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/prepare-release.js
            return false;
        }
    }
    
    formatBytes(bytes, precision = 2) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        let size = bytes;
        let unitIndex = 0;
        
        while (size > 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${Math.round(size * Math.pow(10, precision)) / Math.pow(10, precision)} ${units[unitIndex]}`;
    }
    
    run() {
<<<<<<<< HEAD:saiy2k-nostr-components/prepare-release.js
        console.log('🚀 Saiy2k Nostr Components WordPress Plugin - Release Preparation');
========
        console.log('🚀 Nostr Components (by saiy2k) WordPress Plugin - Release Preparation');
>>>>>>>> 799bc64 ( - Rename WP plugin name for submission):nostr-components-by-saiy2k/prepare-release.js
        console.log('========================================================\n');
        
        if (this.validate()) {
            const zipPath = this.createZip();
            if (zipPath) {
                console.log('\n🎉 Release preparation complete!');
                console.log(`📁 Ready for WordPress.org submission: ${zipPath}`);
                console.log('\n📋 Next steps:');
                console.log('1. Create WordPress.org account (if needed)');
                console.log('2. Submit plugin for review');
                console.log('3. Add screenshots and banner images');
                console.log('4. Respond to any review feedback');
            }
        } else {
            console.log('\n❌ Release preparation failed. Please fix the errors above.');
        }
    }
}

// Run the script
const prep = new NostrWPReleasePrep();
prep.run();
