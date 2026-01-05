#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const width = process.argv[2] || '1920';
const height = process.argv[3] || '1080';
const scale = process.argv[4] || '2';

const repoRoot = process.cwd();
const generator = path.join(repoRoot, 'game', 'tools', 'generate-rule-diagram.js');
const mmdPath = path.join(repoRoot, 'game', 'rule-chain.mmd');
const svgOut = path.join(repoRoot, 'game', `rule-chain-${width}x${height}.svg`);
const pngOut = path.join(repoRoot, 'game', `rule-chain-${width}x${height}.png`);

function run(cmd, args) {
  console.log('> ' + [cmd].concat(args).join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.error) {
    console.error('Error running', cmd, r.error);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error('Command failed with exit code', r.status);
    process.exit(r.status);
  }
}

if (!fs.existsSync(generator)) {
  console.error('Generator not found at', generator);
  process.exit(2);
}

// 1) regenerate mmd
run('node', [generator]);

if (!fs.existsSync(mmdPath)) {
  console.error('Expected MMD file not found at', mmdPath);
  process.exit(3);
}

// 2) render SVG
run('npx', ['@mermaid-js/mermaid-cli', '-i', mmdPath, '-o', svgOut, '-w', width, '-H', height]);

// 3) render PNG (use scale)
run('npx', ['@mermaid-js/mermaid-cli', '-i', mmdPath, '-o', pngOut, '-w', width, '-H', height, '-s', scale]);

console.log('Generated:', svgOut);
console.log('Generated:', pngOut);
