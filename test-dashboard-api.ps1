# Test Dashboard API endpoints
# Run with: .\test-dashboard-api.ps1

$password = Read-Host "Enter admin password" -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

$baseUrl = "http://localhost:54321/functions/v1"

Write-Host "`n=== Testing Dashboard API Endpoints ===" -ForegroundColor Cyan

# Test getBotVisitsStats
Write-Host "`n1. Testing getBotVisitsStats (24h)..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$baseUrl/admin" -Method Post -Body (@{
    action = "getBotVisitsStats"
    password = $passwordPlain
    timeRange = "24h"
} | ConvertTo-Json) -ContentType "application/json"
Write-Host "Success: $($response.success)" -ForegroundColor $(if ($response.success) { "Green" } else { "Red" })
Write-Host "Total Requests: $($response.stats.totalRequests)"
Write-Host "History Points: $($response.stats.history.Count)"

# Test getPageViewsHourly
Write-Host "`n2. Testing getPageViewsHourly..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/admin" -Method Post -Body (@{
        action = "getPageViewsHourly"
        password = $passwordPlain
    } | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Success: $($response.success)" -ForegroundColor $(if ($response.success) { "Green" } else { "Red" })
    Write-Host "Total 24h: $($response.stats.total24h)"
    Write-Host "History Points: $($response.stats.history.Count)"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test getUniqueVisitorsHourly
Write-Host "`n3. Testing getUniqueVisitorsHourly..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/admin" -Method Post -Body (@{
        action = "getUniqueVisitorsHourly"
        password = $passwordPlain
    } | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Success: $($response.success)" -ForegroundColor $(if ($response.success) { "Green" } else { "Red" })
    Write-Host "Total 24h: $($response.stats.total24h)"
    Write-Host "History Points: $($response.stats.history.Count)"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test getTopTrafficCountries
Write-Host "`n4. Testing getTopTrafficCountries..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/admin" -Method Post -Body (@{
        action = "getTopTrafficCountries"
        password = $passwordPlain
    } | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Success: $($response.success)" -ForegroundColor $(if ($response.success) { "Green" } else { "Red" })
    Write-Host "Total: $($response.stats.total)"
    Write-Host "Top Countries: $($response.stats.countries.Count)"
    if ($response.stats.countries.Count -gt 0) {
        Write-Host "Top 3:" -ForegroundColor Cyan
        $response.stats.countries[0..2] | ForEach-Object {
            Write-Host "  - $($_.country): $($_.count)"
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Tests Complete ===" -ForegroundColor Cyan
