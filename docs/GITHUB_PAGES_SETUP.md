# GitHub Pages Configuration

## Issue with Duplicate Workflows

If you're experiencing duplicate GitHub Pages deployments (one publishing the README instead of the game page), this is likely because GitHub Pages has **both** automatic deployment and custom workflow deployment enabled.

## Solution

To fix this issue, you need to configure GitHub Pages to use **only** the custom GitHub Actions workflow:

1. Go to your repository **Settings**
2. Navigate to **Pages** in the left sidebar
3. Under **Build and deployment**, change the **Source** to:
   - Select: **GitHub Actions** (instead of "Deploy from a branch")

This ensures that:
- Only the `.github/workflows/github-pages.yml` workflow deploys to GitHub Pages
- The automatic branch deployment is disabled
- No duplicate deployments occur on merge to main

## Current Workflow

The `github-pages.yml` workflow:
- Triggers on push to `main` branch
- Builds the Rust compiler
- Compiles BRL files to IR
- Builds the TypeScript packages
- Deploys the game demos to GitHub Pages at the repository URL

## Demo Build Workflows

The `build-demo-linux.yml` and `build-demo-windows.yml` workflows:
- Trigger on pull requests to `main` (for testing)
- Trigger on version tags (for releases)
- Create downloadable demo packages
- Do NOT deploy to GitHub Pages
- Create GitHub Releases when version tags are pushed
