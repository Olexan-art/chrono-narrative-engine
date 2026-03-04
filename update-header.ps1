$file = Get-Content -Raw src/pages/admin/NewsProcessingPage.tsx

$newHeader = @"
            <CardHeader>
                <div className="flex justify-between items-center mb-3">
                    <CardTitle>Retell stats</CardTitle>
                    <Button size="sm" onClick={load} disabled={loading}>
                        {`loading ? 'Loading…' : 'Refresh'`}
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button 
                        size="sm" 
                        variant={`selectedHours === 0.5 ? 'default' : 'outline'`}
                        onClick={() => load(0.5)} 
                        disabled={loading}
                    >
                        30 хв.
                    </Button>
                    <Button 
                        size="sm" 
                        variant={`selectedHours === 1 ? 'default' : 'outline'`}
                        onClick={() => load(1)} 
                        disabled={loading}
                    >
                        1 год.
                    </Button>
                    <Button 
                        size="sm" 
                        variant={`selectedHours === 5 ? 'default' : 'outline'`}
                        onClick={() => load(5)} 
                        disabled={loading}
                    >
                        5 год.
                    </Button>
                </div>
            </CardHeader>
"@

# First replace - remove the className attribute from CardHeader
$file = $file -replace '<CardHeader className="flex justify-between items-center">', '<CardHeader>'

# Then replace the entire CardHeader section with the new one
$file = $file -replace '(?s)<CardHeader>.*?</CardHeader>', $newHeader

$file | Set-Content src/pages/admin/NewsProcessingPage.tsx
Write-Host "Updated NewsProcessingPage.tsx with time interval buttons"
