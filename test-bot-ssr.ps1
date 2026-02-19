# Quick test script for bot SSR
# Run this after updating Cloudflare Worker

Write-Host "`n[TEST] QUICK BOT SSR TEST" -ForegroundColor Cyan
Write-Host "=" * 70

$url = 'https://bravennow.com/wiki/0974bc56-e85a-4145-bd65-8348a1ab2192'
$headers = @{'User-Agent' = 'Mozilla/5.0 (compatible; Googlebot/2.1)'}

try {
    $response = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing
    $html = $response.Content
    
    Write-Host "`n[RESULTS]:"
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor $(if($response.StatusCode -eq 200){'Green'}else{'Red'})
    Write-Host "   Length: $($html.Length) chars" -ForegroundColor Cyan
    
    # Check headers
    if ($response.Headers['X-SSR-Source']) {
        Write-Host "   SSR Source: $($response.Headers['X-SSR-Source'])" -ForegroundColor Green
    } else {
        Write-Host "   SSR Source: NOT SET (Worker does not call SSR)" -ForegroundColor Red
    }
    
    # Check content
    $hasArticle = $html -match '<article'
    $hasBreadcrumb = $html -match 'breadcrumb'
    $hasJSWarning = $html -match 'This website requires JavaScript'
    
    Write-Host "`n[CONTENT]:"
    $articleStatus = if($hasArticle){'YES'}else{'NO'}
    $breadcrumbStatus = if($hasBreadcrumb){'YES'}else{'NO'}
    $jsWarningStatus = if($hasJSWarning){'PRESENT'}else{'NONE'}
    
    Write-Host "   Article tag: $articleStatus" -ForegroundColor $(if($hasArticle){'Green'}else{'Red'})
    Write-Host "   Breadcrumbs: $breadcrumbStatus" -ForegroundColor $(if($hasBreadcrumb){'Green'}else{'Red'})
    Write-Host "   JS warning: $jsWarningStatus" -ForegroundColor $(if(-not $hasJSWarning){'Green'}else{'Red'})
    
    if ($hasArticle -and $hasBreadcrumb -and -not $hasJSWarning -and $html.Length -gt 30000) {
        Write-Host "`n[SUCCESS] Bot SSR is working!" -ForegroundColor Green
    } elseif ($html.Length -gt 30000) {
        $charCount = $html.Length
        Write-Host "`n[GOOD] SSR content detected ($charCount chars)" -ForegroundColor Green
    } else {
        $charCount = $html.Length
        Write-Host "`n[FAILED] Still serving SPA ($charCount chars)" -ForegroundColor Red
        Write-Host "`n[TRY]:" -ForegroundColor Yellow
        Write-Host "   1. Re-check Worker code" -ForegroundColor Cyan
        Write-Host "   2. Clear Cloudflare cache again" -ForegroundColor Cyan
        Write-Host "   3. Check Worker logs for errors" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "`n[ERROR] Test failed: $_" -ForegroundColor Red
}

Write-Host "`n" -NoNewline
Write-Host "=" * 70
