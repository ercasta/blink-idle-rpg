#!/usr/bin/env node
/**
 * Build script to create browser bundle from TypeScript source
 * This replaces the direct esbuild command to ensure the bundle is copied to game/demos
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const outFile = path.join(__dirname, '../../../game/app/public/blink-compiler.bundle.js');

// Banner to add at the top of the bundle
const banner = `/**
 * Blink Compiler Browser Bundle
 * Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
 * Build date: ${new Date().toISOString()}
 */
`;

async function build() {
  try {
    console.log('Building browser bundle from TypeScript source...');
    
    await esbuild.build({
      entryPoints: [path.join(srcDir, 'index.ts')],
      bundle: true,
      format: 'iife',
      globalName: 'BlinkCompiler',
      target: 'es2020',
      outfile: outFile,
      banner: { js: banner },
      sourcemap: false,
      minify: false, // Keep readable for debugging
      platform: 'browser',
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      // Tree shaking and optimizations
      treeShaking: true,
      // Log level
      logLevel: 'info',
    });
    
    console.log(`✅ Bundle created successfully: ${outFile}`);
    
    // Get file size
    const stats = fs.statSync(outFile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`📦 Bundle size: ${sizeKB} KB`);
    
  } catch (error) {
    console.error('❌ Bundle build failed:', error);
    process.exit(1);
  }
}

build();
