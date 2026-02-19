# Cloudflare Cache Purge Script (PowerShell)
# This script purges Cloudflare cache for the entire site or specific paths
# Usage:
#   .\clear-cloudflare-cache.ps1                    # Purge entire cache
#   .\clear-cloudflare-cache.ps1 -Path "/wiki/*"    # Purge specific path pattern

param(
    [string]$Path = ""
)

# ⚠️  Set these environment variables before running:
# $env:CF_ZONE_ID = "your_cloudflare_zone_id"
# $env:CF_API_TOKEN = "your_cloudflare_api_token"

if (-not $env:CF_ZONE_ID) {
    Write-Host "❌ Error: CF_ZONE_ID environment variable is not set" -ForegroundColor Red
    Write-Host "Please set it with: `$env:CF_ZONE_ID = 'your_zone_id'" -ForegroundColor Yellow
    exit 1
}

if (-not $env:CF_API_TOKEN) {
    Write-Host "❌ Error: CF_API_TOKEN environment variable is not set" -ForegroundColor Red
    Write-Host "Please set it with: `$env:CF_API_TOKEN = 'your_api_token'" -ForegroundColor Yellow
    exit 1
}

$DOMAIN = "https://bravennow.com"
$ZONE_ID = $env:CF_ZONE_ID
$API_TOKEN = $env:CF_API_TOKEN

$headers = @{
    "Authorization" = "Bearer $API_TOKEN"
    "Content-Type" = "application/json"
}

if ($Path -eq "") {
    # Purge everything
    Write-Host "🧹 Purging entire Cloudflare cache for zone $ZONE_ID..." -ForegroundColor Cyan
    
    $body = @{
        purge_everything = $true
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" `
                                       -Method Post `
                                       -Headers $headers `
                                       -Body $body
        
        if ($response.success) {
            Write-Host "✅ Cloudflare cache purged successfully!" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to purge cache: $($response.errors)" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        exit 1
    }
} else {
    # Purge specific URLs
    Write-Host "🧹 Purging Cloudflare cache for pattern: $Path..." -ForegroundColor Cyan
    
    # Convert pattern to full URL
    $url = "$DOMAIN$Path"
    Write-Host "URL to purge: $url" -ForegroundColor Yellow
    
    $body = @{
        files = @($url)
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" `
                                       -Method Post `
                                       -Headers $headers `
                                       -Body $body
        
        if ($response.success) {
            Write-Host "✅ Cloudflare cache purged for $Path!" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to purge cache: $($response.errors)" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        exit 1
    }
}
