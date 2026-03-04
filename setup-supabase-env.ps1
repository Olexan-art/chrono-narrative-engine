#!/usr/bin/env pwsh

param()

Write-Host "🔧 Setting up Supabase Edge Functions Environment" -ForegroundColor Yellow

# Check for Supabase CLI
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not installed" -ForegroundColor Red
    Write-Host "Install with: npm install -g supabase"
    return
}

# Load .env file
if (Test-Path ".env") {
    Write-Host "📋 Loading .env file..." -ForegroundColor Green
    
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^SUPABASE_SERVICE_ROLE_KEY=(.+)$") {
            $serviceKey = $matches[1].Trim('"').Trim("'")
            Write-Host "✅ Found service key ($($serviceKey.Length) chars)" -ForegroundColor Green
            
            Write-Host "📤 Setting environment variable in Supabase..." -ForegroundColor Yellow
            
            # Use supabase CLI to set the secret
            $env:SUPABASE_SERVICE_ROLE_KEY = $serviceKey
            
            try {
                supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$serviceKey
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Successfully set SERVICE_ROLE_KEY!" -ForegroundColor Green
                    Write-Host "🎉 Cron jobs should now work properly" -ForegroundColor Green
                } else {
                    Write-Host "❌ Failed to set secret" -ForegroundColor Red
                    Write-Host "Make sure you are logged in: supabase auth login" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "❌ Error: $_" -ForegroundColor Red
            }
            
            return
        }
    }
    
    Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env" -ForegroundColor Red
}
else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
}