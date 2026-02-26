// Fix useLanguage imports in all news components
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const newsComponentsDir = './src/components/news';

// Get all .tsx files
const files = readdirSync(newsComponentsDir).filter(f => f.endsWith('.tsx'));

console.log(`Found ${files.length} component files to check`);

files.forEach(file => {
  const filePath = join(newsComponentsDir, file);
  let content = readFileSync(filePath, 'utf8');
  
  // Check if file has incorrect import
  if (content.includes("from '@/hooks/useLanguage'")) {
    console.log(`Fixing imports in ${file}...`);
    
    // Replace the import
    content = content.replace(
      "import { useLanguage } from '@/hooks/useLanguage';",
      "import { useLanguage } from '@/contexts/LanguageContext';"
    );
    
    writeFileSync(filePath, content);
    console.log(`  ✓ Fixed`);
  }
});

console.log('\nAll imports fixed!');