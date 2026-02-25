$k = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0"
$base = "https://tuledxqigzufkecztnlo.supabase.co/rest/v1"
$h = @{ "apikey" = $k }

# 1. Total cached
$r = Invoke-WebRequest -UseBasicParsing "$base/cached_pages?select=id&limit=1" -Headers ($h + @{"Prefer"="count=exact"})
Write-Host "Total cached: $($r.Headers['Content-Range'])"

# 2. Homepage
$r2 = Invoke-WebRequest -UseBasicParsing "$base/cached_pages?path=eq./&select=html_size_bytes,expires_at" -Headers $h
$j = $r2.Content | ConvertFrom-Json
if ($j -and $j[0]) {
    $exp = [datetime]::Parse($j[0].expires_at).ToUniversalTime()
    $mins = [int]($exp - [datetime]::UtcNow).TotalMinutes
    Write-Host "/ cached: size=$($j[0].html_size_bytes) bytes, expires in ${mins} min"
} else {
    Write-Host "/ NOT in cache!"
}

# 3. Cron status
$r3 = Invoke-WebRequest -UseBasicParsing "$base/cron_job_configs?job_name=eq.cache_refresh&select=enabled,frequency_minutes,last_run" -Headers $h
$cron = $r3.Content | ConvertFrom-Json
if ($cron -and $cron[0]) {
    $last = if ($cron[0].last_run) { $cron[0].last_run } else { "never" }
    Write-Host "Cron cache_refresh: enabled=$($cron[0].enabled), every=$($cron[0].frequency_minutes)min, last_run=$last"
}

# 4. Sample new article - check if new pages auto-cache
$r4 = Invoke-WebRequest -UseBasicParsing "$base/cached_pages?select=path,updated_at&order=updated_at.desc&limit=3" -Headers $h
Write-Host "`nNewest cached pages:"
($r4.Content | ConvertFrom-Json) | ForEach-Object { Write-Host "  $($_.path)  @ $($_.updated_at)" }
