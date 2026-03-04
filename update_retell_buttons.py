#!/usr/bin/env python3
import re

file_path = 'src/pages/admin/NewsProcessingPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The old CardHeader pattern
old_pattern = r'<CardHeader>\s+<CardTitle>Retell stats \(last 5 h\)</CardTitle>\s+<Button size="sm" onClick={load} disabled={loading}>\s+{loading \? \'Loading…\' : \'Refresh\'}\s+</Button>\s+</CardHeader>'

# The new CardHeader
new_header = '''<CardHeader>
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
            </CardHeader>'''

# Try regex replacement first
result = re.sub(old_pattern, new_header, content, flags=re.DOTALL)

if result != content:
    print('✓ Updated with regex pattern')
else:
    # Fallback: literal string replacement
    old_literal = '''            <CardHeader>
                <CardTitle>Retell stats (last 5 h)</CardTitle>
                <Button size="sm" onClick={load} disabled={loading}>
                    {loading ? 'Loading…' : 'Refresh'}
                </Button>
            </CardHeader>'''
    
    if old_literal in content:
        result = content.replace(old_literal, '            ' + new_header)
        print('✓ Updated with literal pattern')
    else:
        print('✗ Could not find pattern in file')
        exit(1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(result)

print('✓ NewsProcessingPage.tsx updated successfully')
