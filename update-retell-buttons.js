const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/admin/NewsProcessingPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the CardHeader section in RetellProviderReport
const oldPattern = `            <CardHeader>
                <CardTitle>Retell stats (last 5 h)</CardTitle>
                <Button size="sm" onClick={load} disabled={loading}>
                    {loading ? 'Loading…' : 'Refresh'}
                </Button>
            </CardHeader>`;

const newPattern = `            <CardHeader>
                <div className="flex justify-between items-center mb-3">
                    <CardTitle>Retell stats</CardTitle>
                    <Button size="sm" onClick={load} disabled={loading}>
                        {loading ? 'Loading…' : 'Refresh'}
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button 
                        size="sm" 
                        variant={selectedHours === 0.5 ? 'default' : 'outline'}
                        onClick={() => load(0.5)} 
                        disabled={loading}
                    >
                        30 хв.
                    </Button>
                    <Button 
                        size="sm" 
                        variant={selectedHours === 1 ? 'default' : 'outline'}
                        onClick={() => load(1)} 
                        disabled={loading}
                    >
                        1 год.
                    </Button>
                    <Button 
                        size="sm" 
                        variant={selectedHours === 5 ? 'default' : 'outline'}
                        onClick={() => load(5)} 
                        disabled={loading}
                    >
                        5 год.
                    </Button>
                </div>
            </CardHeader>`;

if (content.includes(oldPattern)) {
    content = content.replace(oldPattern, newPattern);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✓ Updated NewsProcessingPage.tsx with time interval buttons');
} else {
    console.log('✗ Could not find CardHeader pattern in file');
}

