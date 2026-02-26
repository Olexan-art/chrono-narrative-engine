#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const argvPath = process.argv[2];
if (!argvPath) {
  console.error('Usage: node scripts/full_js_render_check.js /path/to/page');
  process.exit(2);
}

const pagePath = argvPath.startsWith('/') ? argvPath : `/${argvPath}`;
const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://bravennow.com';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || 'https://nxkrzecbbkyaajogszjr.supabase.co/functions/v1';

const timestamp = Date.now();
const outDir = path.resolve('archive', 'generated');
await fs.mkdir(outDir, { recursive: true });

const liveUrl = `${PROD_BASE_URL.replace(/\/$/, '')}${pagePath}`;

console.log('Starting full JS render check for:', liveUrl);

const browser = await chromium.launch({ 
  headless: true,
  args: ['--disable-blink-features=AutomationControlled']
});

try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });

  console.log('Navigating to page...');
  await page.goto(liveUrl, { waitUntil: 'networkidle', timeout: 60000 });
  
  // Wait for additional dynamic content
  console.log('Waiting for dynamic content...');
  await page.waitForTimeout(5000);
  
  // Scroll to trigger lazy loading
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);

  // Take screenshot
  const screenshotPath = path.join(outDir, `screenshot_${timestamp}.png`);
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: true 
  });
  console.log('Screenshot saved:', screenshotPath);

  // Get HTML after all loading
  const finalHtml = await page.content();
  
  // Check for sections and their visibility
  const sectionChecks = await page.evaluate(() => {
    const sections = {
      'Verified': ['Verified', '✓ Verified', '.verified-section', '[data-section="verified"]'],
      'Cartoons': ['карикатур', 'Cartoon', '.cartoon-section', '[data-section="cartoon"]'],
      'Keywords': ['Keywords:', 'Ключові слова:', '.keywords-section', '[data-section="keywords"]'],
      'Key Takeaways': ['Key Takeaways', 'Ключові висновки', '.key-takeaways', '[data-section="key-takeaways"]'],
      'Topics': ['Topics:', 'Теми:', '.topics-section', '[data-section="topics"]'],
      'Retelling': ['пересказ', 'Retelling', 'Summary', '.retelling-section', '[data-section="retelling"]'],
      'Why It Matters': ['Why It Matters', 'Чому це важливо', '.why-matters', '[data-section="why-it-matters"]'],
      'Context & Background': ['Context & Background', 'Контекст', '.context-section', '[data-section="context"]'],
      'What Happens Next': ['What Happens Next', 'Що далі', '.what-next', '[data-section="what-next"]'],
      'FAQ': ['Frequently Asked Questions', 'FAQ', '.faq-section', '[data-section="faq"]'],
      'More news about': ['More news about', 'Більше новин про', '.more-news', '[data-section="more-news"]'],
      'Entity Intersection Graph': ['Entity Intersection Graph', 'Граф перетину', '.entity-graph', '[data-section="entity-graph"]'],
      'Source': ['Source:', 'Джерело:', '.source-section', '[data-section="source"]'],
      'Mentioned Entities': ['Mentioned Entities', 'Згадані сутності', '.entities-section', '[data-section="entities"]']
    };
    
    const results = {};
    
    for (const [sectionName, patterns] of Object.entries(sections)) {
      let found = false;
      let element = null;
      let details = { found: false, visible: false, styles: {} };
      
      // Check text content
      for (const pattern of patterns) {
        if (pattern.startsWith('.') || pattern.startsWith('[')) {
          // CSS selector
          element = document.querySelector(pattern);
          if (element) {
            found = true;
            break;
          }
        } else {
          // Text search
          const elements = Array.from(document.querySelectorAll('*'));
          for (const el of elements) {
            if (el.textContent && el.textContent.includes(pattern)) {
              element = el;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
      
      if (element) {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        
        details = {
          found: true,
          visible: rect.width > 0 && rect.height > 0 && 
                  styles.display !== 'none' && 
                  styles.visibility !== 'hidden' &&
                  parseFloat(styles.opacity) > 0,
          styles: {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            position: styles.position,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left
          },
          text: element.textContent?.substring(0, 100) + '...'
        };
      }
      
      results[sectionName] = details;
    }
    
    return results;
  });
  
  // Save detailed report
  const report = {
    path: pagePath,
    liveUrl,
    timestamp,
    screenshot: `screenshot_${timestamp}.png`,
    htmlFile: `full_js_render_${timestamp}.html`,
    sectionAnalysis: sectionChecks
  };
  
  // Save HTML
  await fs.writeFile(path.join(outDir, `full_js_render_${timestamp}.html`), finalHtml, 'utf-8');
  
  // Save report
  await fs.writeFile(
    path.join(outDir, `full_js_report_${timestamp}.json`), 
    JSON.stringify(report, null, 2), 
    'utf-8'
  );
  
  console.log('\nSection Analysis:');
  console.log('==================');
  
  for (const [section, details] of Object.entries(sectionChecks)) {
    if (details.found) {
      console.log(`\n${section}:`);
      console.log(`  Found: YES`);
      console.log(`  Visible: ${details.visible ? 'YES' : 'NO'}`);
      if (!details.visible && details.styles) {
        console.log(`  Hidden by: display=${details.styles.display}, visibility=${details.styles.visibility}, opacity=${details.styles.opacity}`);
      }
      if (details.text) {
        console.log(`  Sample text: ${details.text.substring(0, 50)}...`);
      }
    } else {
      console.log(`\n${section}: NOT FOUND`);
    }
  }
  
  console.log(`\nFull report saved: ${outDir}/full_js_report_${timestamp}.json`);
  console.log(`Screenshot saved: ${outDir}/screenshot_${timestamp}.png`);
  
} catch (error) {
  console.error('Error during render:', error);
} finally {
  await browser.close();
}