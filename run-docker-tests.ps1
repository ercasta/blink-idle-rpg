param(
    [string]$ImageName = 'blink-test-runner'
)

# Determine the repository root based on the script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Building Docker image '$ImageName' from Dockerfile.test in $scriptDir..."
try {
    docker build -f "$scriptDir/Dockerfile.test" -t $ImageName "$scriptDir"
} catch {
    Write-Error "Docker build failed: $_"
    exit 1
}

# Use the script directory as the mount source so the repo root is mounted into the container
$mountPath = $scriptDir

Write-Host "Running container from image '$ImageName' with workspace mounted: $mountPath -> /workspace"

try {
    docker run --rm -v "$mountPath`:/workspace" -w /workspace $ImageName
} catch {
    Write-Error "Docker run failed: $_"
    exit 1
}
