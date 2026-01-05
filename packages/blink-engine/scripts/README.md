# Browser Bundle Build Script

This script automatically generates the browser bundle (`game/demos/blink-engine.bundle.js`) from the TypeScript source code.

## Purpose

The browser bundle is a standalone JavaScript file that can be used directly in HTML without a build system. It's generated automatically from the TypeScript source to ensure:

1. **Single Source of Truth**: TypeScript is the only source - no manual duplication
2. **Consistency**: Bundle always matches TypeScript implementation
3. **Maintainability**: Changes to TypeScript automatically propagate to bundle

## Usage

### Manual Build

```bash
cd packages/blink-engine
npm run build:bundle
```

### Automated Build (via Makefile)

The bundle is automatically built when running:

```bash
make build-packages
```

This is integrated into the build pipeline and runs after TypeScript compilation.

## Build Process

1. TypeScript source is compiled to CommonJS modules in `dist/`
2. esbuild bundles all modules into a single IIFE (Immediately Invoked Function Expression)
3. Bundle is written to `game/demos/blink-engine.bundle.js`
4. Bundle exposes `BlinkEngine` global variable for browser usage

## Configuration

The build script uses esbuild with the following settings:
- **Format**: IIFE (for browser global variable)
- **Target**: ES2020
- **Minification**: Disabled (for debugging)
- **Source Maps**: Disabled
- **Global Name**: `BlinkEngine`

## Important Notes

- **DO NOT** edit `blink-engine.bundle.js` manually - it will be overwritten
- Always make changes in the TypeScript source (`packages/blink-engine/src/`)
- The bundle should be committed to git for easy deployment
- Bundle size is logged during build for monitoring

## Troubleshooting

If the bundle isn't working:
1. Ensure TypeScript builds successfully: `npm run build`
2. Check for esbuild errors in the output
3. Verify the bundle file exists: `ls -lh ../../game/demos/blink-engine.bundle.js`
4. Check browser console for runtime errors
