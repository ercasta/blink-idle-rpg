# Blink Idle RPG - Local Development Pipeline
# This Makefile allows you to run build and test pipelines locally

.PHONY: help all clean build-compiler-ts install-packages build-packages test demo-package dev-setup dev

# Bundle output locations
DEMOS_DIR=game/demos
ENGINE_BUNDLE=$(DEMOS_DIR)/blink-engine.bundle.js
COMPILER_BUNDLE=$(DEMOS_DIR)/blink-compiler.bundle.js

# When set to true, include source_map in IR output for dev tools
SOURCE_MAP_FLAG=--source-map

# Default target
help:
	@echo "Blink Idle RPG - Local Pipeline Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make all              - Build everything (packages, demos)"
	@echo "  make dev-setup        - Quick setup for development (TypeScript only)"
	@echo "  make dev              - Build for development (TypeScript compiler + engine)"
	@echo "  make build-compiler-ts - Build the TypeScript BRL compiler"
	@echo "  make install-packages - Install npm dependencies for packages"
	@echo "  make build-packages   - Build TypeScript packages (blink-engine, blink-test, blink-compiler-ts)"
	@echo "  make test             - Run all tests (packages)"
	@echo "  make test-compiler-ts - Run TypeScript compiler tests only"
	@echo "  make test-packages    - Run package tests only"
	@echo "  make test-examples    - Run example tests"
	@echo "  make demo-package     - Create demo package for distribution"
	@echo "  make clean            - Clean all build artifacts"
	@echo ""

# Build everything
all: install-packages build-packages

# Quick development setup (TypeScript only)
dev-setup:
	@echo "Setting up development environment (TypeScript only)..."
	@echo "Installing dependencies..."
	cd packages/blink-engine && npm install
	cd packages/blink-compiler-ts && npm install
	@echo "Building packages..."
	cd packages/blink-engine && npm run build && npm run build:bundle
	cd packages/blink-compiler-ts && npm run build && npm run build:bundle
	@echo "Verifying bundles..."
	@test -f $(ENGINE_BUNDLE) || (echo "Error: Engine bundle not found at $(ENGINE_BUNDLE)" && exit 1)
	@test -f $(COMPILER_BUNDLE) || (echo "Error: Compiler bundle not found at $(COMPILER_BUNDLE)" && exit 1)
	@echo ""
	@echo "Development setup complete!"
	@echo "Open game/demos/rpg-demo.html in a browser to play."
	@echo "The game will compile BRL/BDL files in real-time using the TypeScript compiler."

# Build for development (TypeScript compiler + engine)
dev: build-compiler-ts build-packages-dev
	@echo "Development build complete!"
	@echo "Open game/demos/rpg-demo.html in a browser to play."

# Build TypeScript compiler
build-compiler-ts:
	@echo "Building TypeScript BRL compiler..."
	cd packages/blink-compiler-ts && npm install && npm run build && npm run build:bundle
	@echo "TypeScript compiler built successfully"
	@test -f $(COMPILER_BUNDLE) || (echo "Error: Compiler bundle not found at $(COMPILER_BUNDLE)" && exit 1)

# Build packages for development
build-packages-dev:
	@echo "Building blink-engine..."
	cd packages/blink-engine && npm install && npm run build && npm run build:bundle
	@echo "Development packages built successfully"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf packages/blink-engine/dist
	rm -rf packages/blink-test/dist
	rm -rf packages/blink-compiler-ts/dist
	rm -rf demo-package
	rm -rf blink-demo-package.zip
	@echo "Clean complete"

# Install npm dependencies
install-packages:
	@echo "Installing npm dependencies..."
	cd packages/blink-engine && npm install
	cd packages/blink-test && npm install
	cd packages/blink-compiler-ts && npm install
	@echo "Dependencies installed"

# Build TypeScript packages and copy artifacts to demo directory
build-packages:
	@echo "Building blink-engine..."
	cd packages/blink-engine && npm run build
	@echo "Building browser bundle..."
	cd packages/blink-engine && npm run build:bundle
	@echo "Building TypeScript compiler..."
	cd packages/blink-compiler-ts && npm run build && npm run build:bundle
	@echo "Building blink-test..."
	cd packages/blink-test && npm run build
	@echo "Packages built successfully"

# Run all tests
test: test-compiler-ts test-packages

# Run TypeScript compiler tests
test-compiler-ts:
	@echo "Running TypeScript compiler tests..."
	cd packages/blink-compiler-ts && npm test
	@echo "TypeScript compiler tests complete"

# Run package tests (only unit tests, not example tests)
test-packages: build-packages
	@echo "Running blink-engine tests..."
	cd packages/blink-engine && npm test
	@echo "Running blink-test tests..."
	cd packages/blink-test && npm test
	@echo "Package tests complete"

# Run example tests
test-examples: build-packages
	@echo "Running example tests..."
	cd game/tests && npm install
	@echo "Note: Some tests may require pre-compiled IR files"
	-cd game/tests && npm test
	@echo "Example tests complete (some may have failed - check output above)"

# Create demo package for distribution
demo-package: dev
	@echo "Creating demo package..."
	mkdir -p demo-package
	
	@echo "Copying demo HTML and JS files..."
	cp game/demos/index.html demo-package/
	cp game/demos/rpg-demo.html demo-package/
	cp $(ENGINE_BUNDLE) demo-package/
	cp $(COMPILER_BUNDLE) demo-package/
	cp game/demos/README.md demo-package/
	
	@echo "Copying source files for in-browser compilation..."
	mkdir -p demo-package/brl
	mkdir -p demo-package/bdl
	cp game/brl/*.brl demo-package/brl/
	cp game/bdl/*.bdl demo-package/bdl/
	
	@echo "Copying BCL files..."
	cp game/bcl/warrior-skills.bcl demo-package/
	cp game/bcl/mage-skills.bcl demo-package/
	cp game/bcl/rogue-skills.bcl demo-package/
	cp game/bcl/cleric-skills.bcl demo-package/
	cp game/bcl/party-config.bcl demo-package/
	
	@echo "Creating BCL ZIP file..."
	cd game/bcl && zip ../../demo-package/party-config.bcl.zip *.bcl
	
	@echo "Demo package contents:"
	ls -la demo-package/
	
	@echo "Creating demo package ZIP..."
	cd demo-package && zip -r ../blink-demo-package.zip .
	@echo "Demo package created: blink-demo-package.zip"

