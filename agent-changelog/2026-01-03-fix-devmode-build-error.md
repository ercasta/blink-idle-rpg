# Fix devmode property missing build error

## Date
2026-01-03

## Problem
The `@blink/test` package was failing to build with TypeScript errors indicating that the `devMode` property was missing from the GameTestOptions type.

## Root Cause
The `GameTestOptions` interface extends `GameOptions` from `@blink/engine`, which includes a `devMode?: boolean` property. However, the `GameTest` class constructor was not properly initializing this property when creating the options object.

Additionally, the `blink-test` package had missing node_modules dependencies, which prevented TypeScript from properly resolving the `@blink/engine` types.

## Changes Made

### 1. Updated GameTest.ts
- Added internal `ResolvedGameTestOptions` interface to explicitly define all required properties
- Changed `private options: Required<GameTestOptions>` to `private options: ResolvedGameTestOptions`
- Added `devMode: options.devMode ?? false` in the options initialization
- Added `devMode: this.options.devMode` when passing options to `BlinkGame.createSync()`

### 2. Installed Dependencies
- Ran `npm install` in `packages/blink-test` to install the missing `@blink/engine` dependency

## Files Modified
- `/home/runner/work/blink-idle-rpg/blink-idle-rpg/packages/blink-test/src/GameTest.ts`

## Verification
- Successfully built `@blink/engine` package with `npm run build`
- Successfully built `@blink/test` package with `npm run build`
- Successfully built all packages with `make build-packages`

## Impact
- The build now completes without errors
- The `devMode` property from `GameOptions` is properly supported in `GameTest`
- No breaking changes to the public API
