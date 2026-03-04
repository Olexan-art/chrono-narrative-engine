# PowerShell script to update Supabase Edge Functions environment variables
# This script requires Supabase CLI to be installed

Write-Host "🔧 Supabase Edge Functions Environment Setup" -ForegroundColor Yellow
Write-Host ""

# Check if supabase CLI is installed
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
    Write-Host "Please install Supabase CLI first:"
    Write-Host "  npm install -g supabase"
    Write-Host "  or visit: https://supabase.com/docs/guides/cli"
    exit 1
}

# Load environment variables from .env
if (Test-Path ".env") {
    Write-Host "📋 Loading environment variables from .env..." -ForegroundColor Green
    
    $envContent = Get-Content ".env" | Where-Object { $_ -and !$_.StartsWith("#") }
    foreach ($line in $envContent) {
        if ($line -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    exit 1
}

# Check if required variables are set
$serviceKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", "Process")
if (-not $serviceKey) {
    Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Service role key found in .env ($($serviceKey.Length) chars)" -ForegroundColor Green
Write-Host ""

Write-Host "📤 Setting SUPABASE_SERVICE_ROLE_KEY in edge functions environment..." -ForegroundColor Yellow

# Set the service role key in Supabase edge functions
try {
    $result = supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$serviceKey" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully set SUPABASE_SERVICE_ROLE_KEY in edge functions" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to set environment variable" -ForegroundColor Red
        Write-Host "Error output: $result" -ForegroundColor Red
        Write-Host "Please check:"
        Write-Host "  1. Supabase CLI is logged in (supabase auth login)"
        Write-Host "  2. Project is linked (supabase link)"
        exit 1
    }
} catch {
    Write-Host "❌ Failed to set environment variable: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Current edge functions secrets:" -ForegroundColor Yellow
supabase secrets list

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host "Edge functions should now have access to the correct SERVICE_ROLE_KEY."
Write-Host "Cron jobs should start working within a few minutes."
Write-Host ""
Write-Host "To verify, run: " -NoNewline
Write-Host "node show-cron-status.mjs" -ForegroundColor Yellow