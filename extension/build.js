#!/usr/bin/env node

/**
 * Build script for agent-browser extension
 * Uses esbuild to bundle TypeScript files
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entrypoints = [
  'background.ts',
  'content.ts',
  'offscreen.ts',
  'welcome.ts',
  'llm-worker.ts',
];

async function build() {
  console.log('🔨 Building agent-browser extension...\n');

  for (const entry of entrypoints) {
    const entryPath = path.join(__dirname, 'entrypoints', entry);
    const outfile = path.join(__dirname, 'public', entry.replace('.ts', '.js'));

    console.log(`  Building ${entry}...`);

    try {
      await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        outfile: outfile,
        platform: 'browser',
        target: 'es2020',
        format: 'iife',
        sourcemap: false,
        minify: false,
        logLevel: 'error',
      });

      console.log(`  ✅ ${entry} → ${path.basename(outfile)}`);
    } catch (error) {
      console.error(`  ❌ Failed to build ${entry}:`, error);
      process.exit(1);
    }
  }

  console.log('\n✨ Build complete!\n');
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
