# Blink Idle RPG - Local Development Pipeline
# This Makefile allows you to run build and test pipelines locally

.PHONY: help all clean build-compiler compile-brl build-packages test demo-package install-packages

# Default target
help:
	@echo "Blink Idle RPG - Local Pipeline Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make all              - Build everything (compiler, packages, demos)"
	@echo "  make build-compiler   - Build the BRL compiler (Rust)"
	@echo "  make compile-brl      - Compile all BRL files to IR"
	@echo "  make install-packages - Install npm dependencies for packages"
	@echo "  make build-packages   - Build TypeScript packages (blink-engine, blink-test)"
	@echo "  make test             - Run all tests (compiler + packages)"
	@echo "  make test-compiler    - Run compiler tests only"
	@echo "  make test-packages    - Run package tests only"
	@echo "  make test-examples    - Run example tests"
	@echo "  make demo-package     - Create demo package for distribution"
	@echo "  make clean            - Clean all build artifacts"
	@echo ""

# Build everything
all: build-compiler compile-brl install-packages build-packages

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf src/compiler/target
	rm -rf packages/blink-engine/dist
	rm -rf packages/blink-test/dist
	rm -rf demo-package
	rm -rf blink-demo-package.zip
	@echo "Clean complete"

# Build the Rust compiler
build-compiler:
	@echo "Building BRL compiler..."
	cd src/compiler && cargo build --release
	@echo "Compiler built successfully"

# Compile all BRL files to IR
compile-brl: build-compiler
	@echo "Compiling BRL files to IR..."
	mkdir -p game/ir
	cd src/compiler && \
	for brl_file in ../../game/brl/*.brl; do \
		filename=$$(basename "$$brl_file" .brl); \
		if [ "$$filename" = "classic-rpg" ]; then \
			./target/release/blink-compiler compile -i "$$brl_file" -o "../../game/ir/$${filename}.ir.json" --pretty \
				--include ../../game/bdl/heroes.bdl \
				--include ../../game/bdl/enemies.bdl \
				--include ../../game/bdl/game-config.bdl; \
			echo "Compiled $${filename}.brl with BDL files -> $${filename}.ir.json"; \
		else \
			./target/release/blink-compiler compile -i "$$brl_file" -o "../../game/ir/$${filename}.ir.json" --pretty; \
			echo "Compiled $${filename}.brl -> $${filename}.ir.json"; \
		fi; \
	done
	@echo "IR files generated:"
	ls -la game/ir/*.ir.json

# Install npm dependencies
install-packages:
	@echo "Installing npm dependencies..."
	cd packages/blink-engine && npm install
	cd packages/blink-test && npm install
	@echo "Dependencies installed"

# Build TypeScript packages
build-packages:
	@echo "Building blink-engine..."
	cd packages/blink-engine && npm run build
	@echo "Building blink-test..."
	cd packages/blink-test && npm run build
	@echo "Packages built successfully"

# Run all tests
test: test-compiler test-packages

# Run compiler tests
test-compiler:
	@echo "Running compiler tests..."
	cd src/compiler && cargo test
	@echo "Compiler tests complete"

# Run package tests (only unit tests, not example tests)
test-packages: build-packages compile-brl
	@echo "Running blink-engine tests..."
	cd packages/blink-engine && npm test
	@echo "Running blink-test tests..."
	cd packages/blink-test && npm test
	@echo "Package tests complete"

# Run example tests
test-examples: build-packages compile-brl
	@echo "Running example tests..."
	cd game/tests && npm install
	@echo "Note: boss-spawn.test.ts may fail - it requires IR with init_entities"
	-cd game/tests && npm test
	@echo "Example tests complete (some may have failed - check output above)"

# Create demo package for distribution
demo-package: compile-brl
	@echo "Creating demo package..."
	mkdir -p demo-package
	
	@echo "Copying demo HTML and JS files..."
	cp game/demos/index.html demo-package/
	cp game/demos/rpg-demo.html demo-package/
	cp game/demos/blink-engine.bundle.js demo-package/
	cp game/demos/README.md demo-package/
	
	@echo "Copying game rule files..."
	cp game/ir/classic-rpg.ir.json demo-package/
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

