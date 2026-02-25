$urls = @(
 'https://bravennow.com/news/us/providence-ri-digs-out-from-three-feet-of-snow',
 'https://bravennow.com/topics/Winter%20Storm',
 'https://bravennow.com/wiki/3aca648b-ce1e-4fc8-b1a8-79c414ba2cbe'
)
$uas = @{
 'browser' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
 'googlebot' = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
 'simplebot' = 'SimpleCrawler/1.0'
}
foreach ($url in $urls) {
  Write-Host "\n=== $url ===" -ForegroundColor Cyan
  foreach ($k in $uas.Keys) {
    $ua = $uas[$k]
    Write-Host "-- UA: $k ($ua)" -ForegroundColor Yellow
    try {
      $r = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{ 'User-Agent' = $ua }
      $status = $r.StatusCode
      Write-Host "Status: $status" -ForegroundColor Green
      $headers = $r.Headers
      $checkHdrs = @('X-Worker-Version','X-SSR-Source','X-Cache','CF-Cache-Status','Server','Content-Type','Content-Length')
      foreach ($h in $checkHdrs) {
        if ($headers[$h]) { Write-Host $h ':' $headers[$h] }
      }
      $body = $r.Content
      $len = $body.Length
      Write-Host "Body length: $len" -ForegroundColor White
      $snippet = if ($len -gt 1000) { $body.Substring(0,1000) } else { $body }
      $snippet = $snippet -replace "\r|\n"," "
      Write-Host "Snippet: $snippet" -ForegroundColor DarkGray
      $containsArticle = $body -match '<article|<main|application/ld\+json'
      Write-Host "Contains article/ld+json/main: $containsArticle"
    } catch {
      $err = $_.Exception.Response
      if ($err) {
        $st = $err.StatusCode.value__
        Write-Host "Request failed status: $st" -ForegroundColor Red
        $respText = '';
        try { $respText = (New-Object System.IO.StreamReader($err.GetResponseStream())).ReadToEnd() } catch {}
        if ($respText.Length -gt 0) { Write-Host "Response body (truncated): $($respText.Substring(0,[math]::Min(500,$respText.Length)))" -ForegroundColor DarkRed }
      } else {
        Write-Host "Request error: $($_.Exception.Message)" -ForegroundColor Red
      }
    }
  }
}
