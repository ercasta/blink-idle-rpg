# GitHub Pages Deployment Configuration

## Issue: Duplicate Workflows

When code is merged to the `main` branch, two workflows are triggered:

1. **Custom Workflow** (`github-pages.yml`): Builds the game and deploys to GitHub Pages using GitHub Actions
2. **Automatic Workflow** ("pages build and deployment"): GitHub's default workflow that publishes from a branch

The automatic workflow publishes the repository README instead of the game page, which is not the desired behavior.

## Root Cause

The repository has GitHub Pages configured to deploy from a branch (likely `main` or `gh-pages`), which triggers GitHub's automatic "pages build and deployment" workflow. However, we have a custom workflow that should be the only deployment method.

## Solution

To fix this issue, the repository settings need to be updated:

### Steps to Configure GitHub Pages

1. Go to the repository settings
2. Navigate to **Settings** → **Pages**
3. Under "Build and deployment", change the **Source** from "Deploy from a branch" to **"GitHub Actions"**

This will:
- Disable the automatic "pages build and deployment" workflow
- Ensure only the custom `github-pages.yml` workflow deploys to GitHub Pages
- Correctly publish the game page (from `_site` directory) instead of the README

### Current Workflow

The `github-pages.yml` workflow:
- Builds the Rust compiler
- Compiles BRL files to IR
- Builds the TypeScript packages
- Creates a deployment-ready `_site` directory with:
  - Game demos (`index.html`, `rpg-demo.html`)
  - Compiled JavaScript bundles
  - Game data files
  - Downloadable game files (BRL, BCL, IR)
- Deploys to GitHub Pages using the standard `actions/deploy-pages@v4` action

This is the correct deployment method and should be the only workflow that runs.

## Verification

After changing the settings:
1. Merge a change to `main`
2. Only the "Deploy to GitHub Pages" workflow should run
3. The site should display the game at the root URL (not the README)

## Note for Maintainers

If you see the "pages build and deployment" workflow running, it means the repository settings are still configured to deploy from a branch. Update the settings as described above to fix this.
