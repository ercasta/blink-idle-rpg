param(
    [string]$ImageName = 'blink-test-runner'
)

# Determine the repository root based on the script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Ensure Docker image '$ImageName' exists (will build if missing)..."
$imageId = docker images -q $ImageName 2>$null
if (-not $imageId) {
    Write-Host "Image not found; building Docker image '$ImageName' from Dockerfile.test in $scriptDir..."
    try {
        docker build -f "$scriptDir/Dockerfile.test" -t $ImageName "$scriptDir"
    } catch {
        Write-Error "Docker build failed: $_"
        exit 1
    }
} else {
    Write-Host "Docker image '$ImageName' already exists; skipping build."
}

# Use the script directory as the mount source so the repo root is mounted into the container
$mountPath = $scriptDir

Write-Host "Running container from image '$ImageName' with workspace mounted: $mountPath -> /workspace"

try {
    Write-Host "Running container from image '$ImageName' with workspace mounted: $mountPath -> /workspace"
    # Use a named docker volume for npm cache to speed repeated runs
    $npmCacheVol = "blink-npm-cache"
    try {
        docker volume inspect $npmCacheVol > $null 2>&1
    } catch {
        docker volume create $npmCacheVol | Out-Null
    }

    docker run --rm -it `
      -v "${mountPath}:/workspace:delegated" `
      -v "${npmCacheVol}:/root/.npm" `
      -w /workspace `
      $ImageName
} catch {
    Write-Error "Docker run failed: $_"
    exit 1
}
