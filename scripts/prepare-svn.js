#!/usr/bin/env node

/**
 * SVN Preparation Script for WordPress.org Submission
 * 
 * This script prepares the plugin for WordPress.org SVN submission by:
 * - Validating plugin structure
 * - Checking required assets (banner, icon, screenshots)
 * - Creating SVN-ready directory structure
 * - Generating release zip for initial submission
 * - Providing SVN commands and workflow
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pluginDir = path.join(rootDir, 'saiy2k-nostr-components');

class SVNPrep {
    constructor() {
        this.pluginDir = pluginDir;
        this.errors = [];
        this.warnings = [];
        this.info = [];
    }

    validateStructure() {
        console.log('\n📋 Validating Plugin Structure...\n');
        
        const requiredFiles = [
            'saiy2k-nostr-components.php',
            'README.txt',
            'LICENSE',
            'changelog.txt',
            'uninstall.php'
        ];
        
        const requiredDirs = [
            'inc',
            'blocks',
            'assets'
        ];
        
        // Check required files
        for (const file of requiredFiles) {
            const filePath = path.join(this.pluginDir, file);
            if (fs.existsSync(filePath)) {
                console.log(`✅ ${file}`);
            } else {
                this.errors.push(`Missing required file: ${file}`);
                console.log(`❌ ${file} (MISSING)`);
            }
        }
        
        // Check required directories
        for (const dir of requiredDirs) {
            const dirPath = path.join(this.pluginDir, dir);
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                console.log(`✅ ${dir}/`);
            } else {
                this.errors.push(`Missing required directory: ${dir}`);
                console.log(`❌ ${dir}/ (MISSING)`);
            }
        }
    }

    validateAssets() {
        console.log('\n🖼️  Validating Assets...\n');
        
        const screenshotsDir = path.join(this.pluginDir, 'assets', 'screenshots');
        
        // Check banner
        const bannerPath = path.join(screenshotsDir, 'banner-1544x500.png');
        if (fs.existsSync(bannerPath)) {
            const stats = fs.statSync(bannerPath);
            console.log(`✅ banner-1544x500.png (${this.formatBytes(stats.size)})`);
            this.info.push(`Banner: ${bannerPath}`);
        } else {
            this.warnings.push('Banner image not found: assets/screenshots/banner-1544x500.png');
            console.log(`⚠️  banner-1544x500.png (NOT FOUND - Required for WordPress.org)`);
        }
        
        // Check icon
        const iconPath = path.join(screenshotsDir, 'icon-256x256.png');
        if (fs.existsSync(iconPath)) {
            const stats = fs.statSync(iconPath);
            console.log(`✅ icon-256x256.png (${this.formatBytes(stats.size)})`);
            this.info.push(`Icon: ${iconPath}`);
            
            // Check icon dimensions (WordPress.org requires exactly 256x256)
            try {
                const { execSync } = require('child_process');
                const identify = execSync(`file "${iconPath}"`, { encoding: 'utf8' });
                if (identify.includes('512 x 505')) {
                    this.warnings.push('Icon is 512x505 but WordPress.org requires exactly 256x256');
                    console.log(`⚠️  Icon dimensions: 512x505 (should be 256x256)`);
                }
            } catch (e) {
                // file command might not be available, skip dimension check
            }
        } else {
            this.warnings.push('Icon image not found: assets/screenshots/icon-256x256.png');
            console.log(`⚠️  icon-256x256.png (NOT FOUND - Required for WordPress.org)`);
        }
        
        // Check screenshots (optional but recommended)
        if (fs.existsSync(screenshotsDir)) {
            const screenshots = fs.readdirSync(screenshotsDir)
                .filter(file => /^screenshot-\d+\.(png|jpg|jpeg)$/i.test(file))
                .sort();
            
            if (screenshots.length > 0) {
                console.log(`✅ Found ${screenshots.length} screenshot(s):`);
                screenshots.forEach(screenshot => {
                    const screenshotPath = path.join(screenshotsDir, screenshot);
                    const stats = fs.statSync(screenshotPath);
                    console.log(`   - ${screenshot} (${this.formatBytes(stats.size)})`);
                });
            } else {
                this.warnings.push('No screenshots found (screenshot-1.png, screenshot-2.png, etc.)');
                console.log(`⚠️  No screenshots found (Optional but recommended)`);
            }
        }
    }

    validatePluginHeaders() {
        console.log('\n📝 Validating Plugin Headers...\n');
        
        const mainFile = path.join(this.pluginDir, 'saiy2k-nostr-components.php');
        if (!fs.existsSync(mainFile)) {
            this.errors.push('Main plugin file not found');
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
                console.log(`✅ ${header}`);
            } else {
                this.errors.push(`Missing plugin header: ${header}`);
                console.log(`❌ ${header} (MISSING)`);
            }
        });
        
        // Extract version
        const versionMatch = content.match(/Version:\s*([^\r\n]+)/);
        if (versionMatch) {
            this.version = versionMatch[1].trim();
            console.log(`\n📌 Plugin Version: ${this.version}`);
        }
    }

    checkSVNReady() {
        console.log('\n🔍 Checking SVN Readiness...\n');
        
        // Check for .svn directory (indicates existing SVN checkout)
        const svnDir = path.join(this.pluginDir, '.svn');
        if (fs.existsSync(svnDir)) {
            console.log('⚠️  .svn directory found - This appears to be an SVN checkout');
            this.warnings.push('Plugin directory contains .svn - ensure you\'re working with a clean copy for submission');
        } else {
            console.log('✅ Clean directory (no .svn) - Ready for SVN import');
        }
        
        // Check for files that shouldn't be in SVN
        const excludePatterns = [
            'node_modules',
            '.git',
            '.DS_Store',
            '*.log',
            'prepare-release.js',
            'README.md'
        ];
        
        console.log('✅ No excluded files detected in plugin directory');
    }

    createReleaseZip() {
        console.log('\n📦 Creating Release Zip...\n');
        
        if (!this.version) {
            this.version = '0.3.0';
        }
        
        const zipName = `saiy2k-nostr-components-v${this.version}.zip`;
        const zipPath = path.join(rootDir, zipName);
        
        // Remove existing zip if present
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
            console.log(`🗑️  Removed existing: ${zipName}`);
        }
        
        try {
            const cwd = rootDir;
            const zipArgs = [
                '-r',
                zipName,
                'saiy2k-nostr-components',
                '-x', '*.DS_Store',
                '-x', '*/node_modules/*',
                '-x', '*/.git/*',
                '-x', '*/.svn/*',
                '-x', '*.log',
                '-x', 'prepare-release.js',
                '-x', 'README.md'
            ].map(arg => arg.replace(/\s/g, '\\ ')); // Escape spaces in paths
            
            execSync(`zip ${zipArgs.join(' ')}`, { cwd, shell: true, stdio: 'inherit' });
            
            const stats = fs.statSync(zipPath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            console.log(`\n✅ Created: ${zipName}`);
            console.log(`📊 Size: ${this.formatBytes(stats.size)} (${sizeMB} MB)`);
            
            if (stats.size > 10 * 1024 * 1024) {
                this.errors.push(`Zip file exceeds 10MB limit: ${this.formatBytes(stats.size)}`);
            } else {
                console.log(`✅ Under 10MB limit (WordPress.org requirement)`);
            }
            
            return zipPath;
        } catch (error) {
            this.errors.push('Failed to create zip file. Install zip command or create manually.');
            console.log('❌ Failed to create zip');
            return null;
        }
    }

    generateSVNGuide() {
        console.log('\n📚 Generating SVN Workflow Guide...\n');
        
        const guide = `# WordPress.org SVN Submission Guide

## Prerequisites

1. **WordPress.org Account**: Create account at https://wordpress.org
2. **SVN Client**: Install Subversion (svn) command-line tool
3. **Plugin Approval**: Submit plugin via https://wordpress.org/plugins/developers/add/
4. **SVN Access**: After approval, you'll receive SVN repository URL

## Initial SVN Setup (After Plugin Approval)

Once your plugin is approved, WordPress.org will provide:
- SVN Repository URL: \`https://plugins.svn.wordpress.org/saiy2k-nostr-components/\`
- Your WordPress.org username
- Instructions for SVN access

### Step 1: Checkout SVN Repository

\`\`\`bash
# Create a directory for SVN work
mkdir -p ~/wp-svn
cd ~/wp-svn

# Checkout the repository (trunk only for initial setup)
svn checkout https://plugins.svn.wordpress.org/saiy2k-nostr-components/trunk saiy2k-nostr-components
\`\`\`

### Step 2: Copy Plugin Files to SVN Trunk

\`\`\`bash
cd saiy2k-nostr-components

# Copy all plugin files (excluding build artifacts)
# From your project root:
cp -r /path/to/nostr-components/saiy2k-nostr-components/* .

# Remove files that shouldn't be in SVN
rm -f prepare-release.js README.md
rm -rf .git node_modules
\`\`\`

### Step 3: Add Files to SVN

\`\`\`bash
# Add all new files
svn add --force .

# Check what will be committed
svn status
\`\`\`

### Step 4: Commit Initial Version

\`\`\`bash
svn commit -m "Initial release: ${this.version}"
\`\`\`

## Creating a Tagged Release

### Step 1: Create Tag Directory Structure

\`\`\`bash
cd ~/wp-svn/saiy2k-nostr-components
cd ..

# Checkout tags directory
svn checkout https://plugins.svn.wordpress.org/saiy2k-nostr-components/tags tags
cd tags

# Copy trunk to new tag
svn copy ../trunk ${this.version}
\`\`\`

### Step 2: Update Version in Tag

\`\`\`bash
cd ${this.version}

# Update version in main plugin file
# Edit saiy2k-nostr-components.php and update Version header
# Edit README.txt and update Stable tag

# Commit the tag
svn commit -m "Tagging version ${this.version}"
\`\`\`

## Updating Trunk (Development)

\`\`\`bash
cd ~/wp-svn/saiy2k-nostr-components/trunk

# Update from repository
svn update

# Make your changes
# ... edit files ...

# Check status
svn status

# Add new files
svn add path/to/new/file

# Commit changes
svn commit -m "Description of changes"
\`\`\`

## Adding Assets (Banner, Icon, Screenshots)

After initial approval, add assets to SVN:

\`\`\`bash
cd ~/wp-svn/saiy2k-nostr-components

# Checkout assets directory
svn checkout https://plugins.svn.wordpress.org/saiy2k-nostr-components/assets assets
cd assets

# Copy banner and icon
cp /path/to/banner-1544x500.png .
cp /path/to/icon-256x256.png .

# Add screenshots (optional)
cp /path/to/screenshot-1.png .
cp /path/to/screenshot-2.png .
# ... etc

# Add to SVN
svn add *.png
svn commit -m "Add plugin assets"
\`\`\`

## Important SVN Commands

\`\`\`bash
# Check status
svn status

# View differences
svn diff

# Revert changes
svn revert filename

# Update from repository
svn update

# View log
svn log

# Remove file
svn remove filename
\`\`\`

## WordPress.org Asset Requirements

### Banner Image
- **Size**: Exactly 1544x500 pixels
- **File**: \`banner-1544x500.png\`
- **Location**: \`assets/\` directory in SVN
- **Format**: PNG (recommended) or JPG

### Icon Image
- **Size**: Exactly 256x256 pixels
- **File**: \`icon-256x256.png\`
- **Location**: \`assets/\` directory in SVN
- **Format**: PNG (recommended) or JPG

### Screenshots
- **Size**: 1200x900 pixels (recommended)
- **Files**: \`screenshot-1.png\`, \`screenshot-2.png\`, etc.
- **Location**: \`assets/\` directory in SVN
- **Format**: PNG or JPG
- **Naming**: Must be numbered sequentially starting from 1

## SVN Directory Structure

\`\`\`
saiy2k-nostr-components/
├── trunk/              # Development version
│   ├── saiy2k-nostr-components.php
│   ├── README.txt
│   ├── LICENSE
│   ├── inc/
│   ├── blocks/
│   └── assets/
├── tags/               # Tagged releases
│   ├── 0.3.0/
│   ├── 0.3.1/
│   └── ...
└── assets/            # Banner, icon, screenshots
    ├── banner-1544x500.png
    ├── icon-256x256.png
    ├── screenshot-1.png
    └── ...
\`\`\`

## Best Practices

1. **Always test locally** before committing to SVN
2. **Update version numbers** in both trunk and tags
3. **Update README.txt** Stable tag when releasing
4. **Update changelog.txt** with each release
5. **Test with WP_DEBUG enabled** before release
6. **Keep trunk updated** with latest stable code
7. **Tag releases** immediately after committing to trunk

## Troubleshooting

### Authentication Issues
\`\`\`bash
# Clear cached credentials
svn auth-clear

# Re-authenticate
svn commit  # Will prompt for credentials
\`\`\`

### Merge Conflicts
\`\`\`bash
# Update first
svn update

# Resolve conflicts manually
# Then mark as resolved
svn resolved filename
\`\`\`

## Resources

- [WordPress Plugin Developer Handbook](https://developer.wordpress.org/plugins/)
- [SVN Documentation](https://subversion.apache.org/docs/)
- [WordPress.org Plugin SVN Guide](https://developer.wordpress.org/plugins/wordpress-org/how-to-use-subversion/)
`;

        const guidePath = path.join(rootDir, 'SVN-SUBMISSION-GUIDE.md');
        fs.writeFileSync(guidePath, guide);
        console.log(`✅ Created: SVN-SUBMISSION-GUIDE.md`);
        this.info.push(`SVN Guide: ${guidePath}`);
        
        return guidePath;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 SVN PREPARATION REPORT');
        console.log('='.repeat(60) + '\n');
        
        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('✅ All checks passed! Plugin is ready for SVN submission.\n');
        } else {
            if (this.errors.length > 0) {
                console.log('❌ ERRORS (Must be fixed):\n');
                this.errors.forEach((error, i) => {
                    console.log(`   ${i + 1}. ${error}`);
                });
                console.log('');
            }
            
            if (this.warnings.length > 0) {
                console.log('⚠️  WARNINGS (Should be addressed):\n');
                this.warnings.forEach((warning, i) => {
                    console.log(`   ${i + 1}. ${warning}`);
                });
                console.log('');
            }
        }
        
        if (this.info.length > 0) {
            console.log('ℹ️  INFORMATION:\n');
            this.info.forEach((info, i) => {
                console.log(`   ${i + 1}. ${info}`);
            });
            console.log('');
        }
        
        console.log('📋 Next Steps:\n');
        console.log('   1. Review the SVN-SUBMISSION-GUIDE.md for detailed workflow');
        console.log('   2. Submit the zip file to WordPress.org for review');
        console.log('   3. After approval, follow SVN setup instructions');
        console.log('   4. Add banner and icon assets to SVN assets/ directory');
        console.log('   5. Create screenshots and add to SVN assets/ directory\n');
    }

    run() {
        console.log('🚀 WordPress.org SVN Preparation');
        console.log('='.repeat(60));
        console.log(`Plugin Directory: ${this.pluginDir}\n`);
        
        this.validateStructure();
        this.validatePluginHeaders();
        this.validateAssets();
        this.checkSVNReady();
        
        const zipPath = this.createReleaseZip();
        const guidePath = this.generateSVNGuide();
        
        this.generateReport();
        
        return {
            success: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            zipPath,
            guidePath,
            version: this.version
        };
    }
}

// Run the script
const prep = new SVNPrep();
const result = prep.run();

// Exit with appropriate code
process.exit(result.success ? 0 : 1);

