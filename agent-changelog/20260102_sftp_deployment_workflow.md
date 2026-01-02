# Agent Changelog - SFTP Deployment Workflow

**Date:** 2026-01-02
**Agent:** GitHub Copilot
**Request:** Create a GitHub workflow to publish the game on a web server accessible by SFTP

## Problem Statement

Create a GitHub workflow to publish the game on a web server accessible by SFTP. Be careful about how credentials are managed (maybe they can be stored as secrets). Also we need a variable to specify the folder on SFTP in which to publish the files.

## Changes to hielements.hie

### Added Elements:

1. **CI/CD Section** (New)
   - Added `ci_cd` element under `blink_project`
   - Added `workflows` element under `ci_cd`
   - Added `sftp_deploy_workflow` element to track SFTP deployment workflow
   - Scope: `.github/workflows/deploy-sftp.yml`
   - Purpose: Automate deployment of game demos to web server via SFTP

### Rationale:

The new workflow extends the existing CI/CD infrastructure (build-demo-linux.yml and build-demo-windows.yml) to include deployment capabilities. This aligns with the project's goal of making the game accessible to users.

## Implementation Plan

### 1. Workflow File
- **File:** `.github/workflows/deploy-sftp.yml`
- **Purpose:** Build demo package and deploy to SFTP server
- **Triggers:**
  - Push to main branch
  - Manual workflow dispatch with configurable target folder
  - Tags (v*)

### 2. Workflow Steps:
1. Checkout repository
2. Set up Rust toolchain
3. Build BRL compiler
4. Compile BRL files to IR
5. Create demo package (similar to build-demo-linux.yml)
6. Upload to SFTP server using GitHub Action

### 3. Security Implementation:
- **GitHub Secrets** (to be configured in repository settings):
  - `SFTP_HOST`: SFTP server hostname
  - `SFTP_PORT`: SFTP server port (default: 22)
  - `SFTP_USERNAME`: SFTP username
  - `SFTP_PASSWORD`: SFTP password (or use SSH key)
  - `SFTP_SSH_KEY`: SSH private key (alternative to password)
  
- **Workflow Inputs:**
  - `target_folder`: SFTP target directory path (configurable via workflow_dispatch)

### 4. SFTP Action Selection:
Using `wlixcc/SFTP-Deploy-Action@v1.2.4` - a well-maintained GitHub Action for SFTP deployments

## Files Modified:
1. `hielements.hie` - Added CI/CD workflow documentation
2. `.github/workflows/deploy-sftp.yml` - New SFTP deployment workflow

## Testing Plan:
1. Validate workflow YAML syntax
2. Document required secrets in README or workflow comments
3. Test workflow manually via workflow_dispatch
