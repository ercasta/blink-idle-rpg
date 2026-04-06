# BRL User Guide

**Blink Rule Language (BRL)** - A comprehensive guide for game developers

**Version**: 0.1.0  
**Last Updated**: 2024-12-31

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Quick Reference](#quick-reference)
4. [Step-by-Step Tutorials](#step-by-step-tutorials)
5. [Common Patterns](#common-patterns)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Complete Examples](#complete-examples)

---

## Introduction

### What is BRL?

BRL (Blink Rule Language) is a domain-specific language for defining game rules in the Blink Idle RPG engine. It's designed for **game developers** who want to create engaging idle RPG experiences.

### Who Should Use This Guide?

This guide is for:
- Game developers creating new Blink games
- Programmers familiar with basic programming concepts
- Anyone who wants to define game mechanics, components, and rules

### Key Features

- **Declarative Syntax**: Describe what should happen, not how
- **Type Safety**: Catch errors before runtime
- **Event-Driven**: React to game events with rules
- **ECS Architecture**: Entity-Component-System for flexible design

---

## Getting Started

### Installation

#### Prerequisites

Before using BRL, you need:
- **Node.js & npm** (for the compiler and engine): Install from [nodejs.org](https://nodejs.org/)


### Compiling Your Code

```bash
# Compile to IR (Intermediate Representation) using the TypeScript compiler
npx @blink/compiler-ts compile -i clicker.brl -o clicker.ir.json --pretty

# Check for errors without compiling
npx @blink/compiler-ts check -i clicker.brl
```

### Running Your Game

The engine is compiled to WebAssembly via the Rust runtime (`blink-runtime`).
See `doc/WORKFLOW.md` for the full build and run workflow.

```bash
# Build WASM engine
npm run build:wasm

# Run the web app
npm run dev:app
```

---

## Quick Reference

### Syntax at a Glance

```brl
// Comments
// Single-line comment
/* Multi-line comment */

// Components (data structures)
component ComponentName {
    field: type
}

// Rules (event reactions)
rule RuleName on EventType {
    // code here
}

// Functions
fn function_name(param: type): return_type {
    return value
}

// Modules
module module_name {
    // declarations
}
```

---

## Step-by-Step Tutorials

... (full tutorials are in this file; see repository for complete content)
