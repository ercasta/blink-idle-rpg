# Integrated IDE with Debug Mode

**Date:** 2026-01-03
**Context:** Implementation of integrated IDE for BRL/BCL/BDL with source mapping and step-by-step debugging

## Summary

Implemented an integrated IDE feature for the Blink language family (BRL/BCL/BDL) that allows developers to debug game rules step-by-step, view source code with syntax highlighting, and see which rules are executing in real-time.

## Changes Made

### 1. Source Mapping in IR Types (TypeScript Engine)

Added source mapping types to `packages/blink-engine/src/ir/types.ts`:
- `SourceLocation` - Contains file, line, column, endLine, endColumn
- `SourceFile` - Contains path, content, and language type (brl/bcl/bdl)
- `SourceMap` - Contains array of source files

Added `source_location` optional field to:
- `IRComponent`
- `IRRule`
- `IRFunction`
- All `IRAction` types (IRModifyAction, IRScheduleAction, IREmitAction, IRSpawnAction, IRDespawnAction)

### 2. Debug Mode in BlinkGame

Updated `packages/blink-engine/src/BlinkGame.ts`:
- Added `DebugEvent` interface for debugging events
- Added `devMode` option in `GameOptions`
- Added `debugCallbacks` for debug event subscriptions
- Added `onDebug(callback)` method to subscribe to debug events
- Added `setDevMode(enabled)` and `getDevMode()` methods
- Added `getSourceMap()` method to retrieve source files
- Added `getRules()` method to retrieve loaded rules
- Added `executeRuleWithDebug()` private method that emits `rule_start` and `rule_end` events

### 3. Browser Bundle Updates

Updated `game/demos/blink-engine.bundle.js`:
- Added `devMode` option support
- Added `debugCallbacks` set
- Added `onDebug()` subscription method
- Added `setDevMode()`, `getDevMode()`, `getSourceMap()`, `getRules()` methods
- Added `emitDebugEvent()` method
- Modified `step()` to call `executeRuleWithDebug()` when in dev mode

### 4. Demo UI - Dev Mode Panel

Updated `game/demos/rpg-demo.html`:

**CSS additions:**
- `.dev-mode-panel` - Collapsible panel styling
- `.source-viewer` - Code viewer with monospace font
- `.source-line` - Individual source line styling
- `.source-line.highlighted` - Yellow background for currently executing line
- `.line-number` - Line number styling
- `.source-file-tabs` - Tab buttons for BRL/BCL/BDL files
- Syntax highlighting classes: `.keyword`, `.string`, `.number`, `.comment`, `.entity`

**HTML additions:**
- "Dev Mode" toggle button in controls
- Dev Mode panel with:
  - Step / Step x10 / Step x100 buttons
  - Debug info showing Current Rule, Event Type, Source Location
  - Source file tabs (BRL Rules, BCL Strategy, BDL Data)
  - Source code viewer with syntax highlighting

**JavaScript additions:**
- `devModeEnabled` flag
- `sourceFiles` object with sample BRL/BCL/BDL content
- Event listeners for step buttons
- `updateSourceDisplay()` function with syntax highlighting
- `applySyntaxHighlighting()` function for BRL/BCL/BDL keywords
- `handleDebugEvent()` function to update UI on rule execution
- Debug callback registration in `initGame()`

## Features

1. **Dev Mode Toggle** - Button to enable/disable debug mode
2. **Step-by-Step Execution** - Execute one event at a time, or 10/100 at once
3. **Source Code Display** - View BRL/BCL/BDL source with syntax highlighting
4. **Line Highlighting** - See which rule is currently executing
5. **Debug Info Panel** - Shows current rule name, event type, and source location

## Usage

1. Click "Dev Mode" button to enable debug mode
2. The Dev Mode panel appears showing the source code viewer
3. Use "Step" button to execute one event at a time
4. Watch the Current Rule and Event Type update
5. See line highlighting in the source viewer (when source locations are in IR)
6. Switch between BRL/BCL/BDL tabs to view different source files

## Architecture

```
BlinkGame
├── devMode flag
├── debugCallbacks Set
├── onDebug(callback) - subscribe
├── setDevMode(enabled) - toggle
├── step()
│   └── if devMode: executeRuleWithDebug()
└── executeRuleWithDebug(rule, event)
    ├── emitDebugEvent({ type: 'rule_start', rule, sourceLocation })
    ├── executor.executeRule()
    └── emitDebugEvent({ type: 'rule_end', rule, sourceLocation })
```

## Future Enhancements

1. **Compiler Source Mapping** - Update Rust compiler to emit source locations in IR
2. **Breakpoints** - Add ability to set breakpoints on specific rules/lines
3. **Variable Inspection** - Show entity component values during execution
4. **BCL Integration** - Load and display actual BCL files from party config
5. **BDL Integration** - Load and display BDL entity definitions

## File Structure

```
packages/blink-engine/src/
├── ir/types.ts           # SourceLocation, SourceFile, SourceMap types
├── BlinkGame.ts          # DebugEvent, onDebug(), devMode support
└── index.ts              # Export new types

game/demos/
├── blink-engine.bundle.js # Browser bundle with debug support
└── rpg-demo.html          # Dev Mode UI panel
```
