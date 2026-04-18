<#
.SYNOPSIS
  Windows PowerShell helper to install, build and smoke-test the Blink repo.

.DESCRIPTION
  Automates the Windows equivalents of Makefile targets: installs npm deps,
  builds TypeScript packages, compiles BRL -> IR, and builds the wasm-js wrapper.

.PARAMETER SmokeTest
  If passed, runs the package smoke test (if available).
#>

[CmdletBinding()]
param(
  [switch]$SmokeTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Run-NodeCmd($path, $cmd) {
  Push-Location $path
  Write-Host "==> $cmd (in $path)"
  & $cmd
  Pop-Location
}

try {
  Write-Host "Starting Windows build helper..."

  # Install npm deps for key packages
  $pkgs = @(
    "packages\blink-engine",
    "packages\blink-test",
    "packages\blink-compiler-ts"
  )
  foreach ($p in $pkgs) {
    Write-Host "Installing npm dependencies for $p"
    Push-Location $p
    npm install
    Pop-Location
  }

  # Build packages (following Makefile targets)
  Write-Host "Building packages..."
  Push-Location "packages\blink-engine"
  npm run build
  if (Test-Path package.json -PathType Leaf) {
    # build:bundle may be defined; ignore errors if not
    try { npm run build:bundle } catch { Write-Host "No build:bundle target or it failed; continuing." }
  }
  Pop-Location

  Push-Location "packages\blink-compiler-ts"
  npm run build
  try { npm run build:bundle } catch { Write-Host "No build:bundle target or it failed; continuing." }
  Pop-Location

  # Build the Node-capable wasm wrapper package
  if (Test-Path "packages\blink-engine-wasm-js\package.json") {
    Write-Host "Building packages\blink-engine-wasm-js"
    Push-Location "packages\blink-engine-wasm-js"
    npm install
    npm run build
    Pop-Location
  } else {
    Write-Host "packages\blink-engine-wasm-js not found — skipping wasm-js build."
  }

  if ($SmokeTest) {
    Write-Host "Running smoke test (if available)"
    $harness = "packages\blink-engine-wasm-js\bin\run-demo.js"
    if (Test-Path $harness) {
      node $harness --ir ..\..\ir\classic-rpg.ir.json
    } else {
      Write-Host "No harness found at $harness — try running a manual demo or check package docs."
    }
  }

  Write-Host "Windows build helper completed successfully."
} catch {
  Write-Error "Build helper failed: $_"
  exit 1
}
