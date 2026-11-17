param (
    [string]$Scenario = "smoke",
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SAMSAT PKB Benchmark Orchestrator" -ForegroundColor Cyan
Write-Host "Scenario: $Scenario | Target: $BaseUrl" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check if native k6 is installed
if (Get-Command "k6" -ErrorAction SilentlyContinue) {
    Write-Host "Found native k6 binary. Executing scenario..." -ForegroundColor Green
    $script = "./k6/scenarios/$Scenario-test.js"
    if (-not (Test-Path $script)) {
        $script = "./k6/scenarios/$Scenario.js"
    }
    k6 run -e BASE_URL=$BaseUrl $script
    exit $LASTEXITCODE
}

# 2. Check if Docker is available
$dockerAvailable = $false
try {
    $info = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerAvailable = $true
    }
} catch {}

if ($dockerAvailable) {
    Write-Host "Running k6 via official grafana/k6 Docker container..." -ForegroundColor Green
    $script = "/scripts/$Scenario-test.js"
    docker run --rm -i -v "${PWD}/k6/scenarios:/scripts:ro" -e BASE_URL=$BaseUrl grafana/k6:latest run $script
    exit $LASTEXITCODE
}

# 3. Fallback to high-performance native benchmark runner
Write-Host "k6 binary / Docker not detected in active shell session." -ForegroundColor Yellow
Write-Host "Running high-performance benchmark suite (Node.js engine)..." -ForegroundColor Yellow
node ./k6/native-bench.mjs $Scenario
exit $LASTEXITCODE
