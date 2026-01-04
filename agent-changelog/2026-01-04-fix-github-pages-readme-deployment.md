# Fix GitHub Pages Deployment - Remove README.md

## Date
2026-01-04

## Problem
The GitHub Pages deployment sometimes deployed the README.md instead of the game pages (index.html). This happened because the workflow was copying both index.html and README.md to the _site directory, and GitHub Pages' default behavior in certain scenarios is to serve README.md as HTML instead of index.html.

## Root Cause
The workflow file (.github/workflows/github-pages.yml) was explicitly copying game/demos/README.md to the _site deployment directory (lines 110-113). This README file is intended for developers viewing the source code, not for the deployed website.

## Solution
Removed the README.md copy step from the GitHub Pages workflow. The README.md file in game/demos/ is now only available in the repository source code and is not included in the deployed site.

## Changes Made
- Modified `.github/workflows/github-pages.yml` to remove lines 110-113 that copied README.md to _site/
- The workflow now only copies essential HTML and JS files needed for the demos

## Impact
- GitHub Pages will now consistently serve index.html as the default page
- The README.md file remains available in the repository for developers but is not deployed
- No impact on functionality - the README was only documentation for local development

## Testing
The change is minimal and surgical - simply removing an unnecessary file copy operation. The deployment will work correctly with just the HTML and JS files needed for the demos to function.
