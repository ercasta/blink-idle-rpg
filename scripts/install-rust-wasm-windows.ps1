# Install Rust and wasm-pack on Windows
#
# Run this script once before using `npm run build:wasm`.
# Open PowerShell as a regular user (no admin required for Rust).
#
# Usage:
#   .\scripts\install-rust-wasm-windows.ps1
#
# What this script does:
#   1. Downloads and runs the official Rust installer (rustup-init.exe)
#   2. Adds the wasm32-unknown-unknown compilation target
#   3. Installs wasm-pack via cargo
#
# After this script completes, restart your terminal so that the new
# PATH entries (rustup, cargo, wasm-pack) take effect.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── 1. Install Rust via rustup ───────────────────────────────────────────────
if (Get-Command rustup -ErrorAction SilentlyContinue) {
    Write-Host "✓  rustup already installed – skipping Rust install"
    rustup update stable
} else {
    Write-Host "→  Downloading rustup-init.exe..."
    $rustupInstaller = "$env:TEMP\rustup-init.exe"
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupInstaller
    Write-Host "→  Running Rust installer (follow the prompts, default options are fine)..."
    & $rustupInstaller --default-toolchain stable --profile minimal -y
    Remove-Item $rustupInstaller

    # Reload PATH so cargo / rustup are available in this session
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
}

# ── 2. Add the WASM compilation target ──────────────────────────────────────
Write-Host "→  Adding wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown

# ── 3. Install wasm-pack ─────────────────────────────────────────────────────
if (Get-Command wasm-pack -ErrorAction SilentlyContinue) {
    Write-Host "✓  wasm-pack already installed"
} else {
    Write-Host "→  Installing wasm-pack via cargo (this may take a few minutes)..."
    cargo install wasm-pack
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "✅  Done!  Rust, wasm32 target, and wasm-pack are ready."
Write-Host "    If this is a fresh install, restart your terminal before continuing."
Write-Host ""
Write-Host "Next step:  npm run build:wasm"
