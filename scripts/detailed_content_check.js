#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const argvPath = process.argv[2];
if (!argvPath) {
  console.error('Usage: node scripts/detailed_content_check.js /path/to/page');
  process.exit(2);
}

const pagePath = argvPath.startsWith('/') ? argvPath : `/${argvPath}`;
const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://bravennow.com';

const timestamp = Date.now();
const outDir = path.resolve('archive', 'generated');
await fs.mkdir(outDir, { recursive: true });

const liveUrl = `${PROD_BASE_URL.replace(/\/$/, '')}${pagePath}`;

console.log('Starting detailed content check for:', liveUrl);

const browser = await chromium.launch({ 
  headless: true,
  args: ['--disable-blink-features=AutomationControlled']
});

try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'uk-UA'
  });
  
  const page = await context.newPage();

  console.log('Navigating to page...');
  const response = await page.goto(liveUrl, { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Response status:', response.status());
  
  // Wait for article content
  try {
    await page.waitForSelector('article', { timeout: 10000 });
  } catch (e) {
    console.log('No article element found, checking for main content...');
  }
  
  // Extra wait for dynamic content
  await page.waitForTimeout(5000);
  
  // Trigger lazy loading by scrolling
  console.log('Scrolling to load all content...');
  await page.evaluate(() => {
    const scrollStep = window.innerHeight;
    const scrollHeight = document.body.scrollHeight;
    let currentPosition = 0;
    
    const scrollInterval = setInterval(() => {
      window.scrollTo(0, currentPosition);
      currentPosition += scrollStep;
      
      if (currentPosition >= scrollHeight) {
        clearInterval(scrollInterval);
        window.scrollTo(0, 0);
      }
    }, 100);
  });
  
  await page.waitForTimeout(5000);

  // Take multiple screenshots
  const screenshotDir = path.join(outDir, `screenshots_${timestamp}`);
  await fs.mkdir(screenshotDir, { recursive: true });
  
  await page.screenshot({ 
    path: path.join(screenshotDir, 'full_page.png'), 
    fullPage: true 
  });
  
  // Take viewport screenshot
  await page.screenshot({ 
    path: path.join(screenshotDir, 'viewport.png'), 
    fullPage: false 
  });

  // Extract all text content with structure
  const pageContent = await page.evaluate(() => {
    const content = {
      title: '',
      sections: [],
      allHeaders: [],
      allParagraphs: [],
      missingContent: []
    };
    
    // Get title
    const titleEl = document.querySelector('h1');
    content.title = titleEl?.textContent?.trim() || '';
    
    // Get all headers
    const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headers.forEach(h => {
      content.allHeaders.push({
        level: h.tagName,
        text: h.textContent?.trim() || '',
        visible: window.getComputedStyle(h).display !== 'none'
      });
    });
    
    // Get all paragraphs
    const paragraphs = document.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      if (text.length > 10) {
        content.allParagraphs.push({
          text: text.substring(0, 100),
          visible: window.getComputedStyle(p).display !== 'none'
        });
      }
    });
    
    // Search for specific sections
    const sectionPatterns = [
      { name: 'Verified', patterns: ['Verified', '✓ Verified', 'Перевірено'] },
      { name: 'Cartoons', patterns: ['карикатур', 'Cartoon', 'Caricature'] },
      { name: 'Keywords', patterns: ['Keywords:', 'Ключові слова:', 'Keywords'] },
      { name: 'Key Takeaways', patterns: ['Key Takeaways', 'Ключові висновки', 'Key takeaways'] },
      { name: 'Topics', patterns: ['Topics:', 'Теми:', 'Topics'] },
      { name: 'Retelling', patterns: ['пересказ', 'Retelling', 'Summary', 'Переказ'] },
      { name: 'Why It Matters', patterns: ['Why It Matters', 'Чому це важливо', 'Why it matters'] },
      { name: 'Context & Background', patterns: ['Context & Background', 'Контекст', 'Context and Background', 'Контекст і передумови'] },
      { name: 'What Happens Next', patterns: ['What Happens Next', 'Що далі', 'What happens next'] },
      { name: 'FAQ', patterns: ['Frequently Asked Questions', 'FAQ', 'Часті питання', 'Frequently asked questions'] },
      { name: 'More news about', patterns: ['More news about', 'Більше новин про', 'More news'] },
      { name: 'Entity Intersection Graph', patterns: ['Entity Intersection Graph', 'Граф перетину', 'Entity intersection'] },
      { name: 'Source', patterns: ['Source:', 'Джерело:', 'Source'] },
      { name: 'Mentioned Entities', patterns: ['Mentioned Entities', 'Згадані сутності', 'Mentioned entities'] }
    ];
    
    sectionPatterns.forEach(section => {
      let found = false;
      let element = null;
      
      // Try to find by text content
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.textContent || '';
        for (const pattern of section.patterns) {
          if (text.includes(pattern) && el.children.length <= 2) {
            // Found a match, check if it's a header or label
            const tagName = el.tagName.toLowerCase();
            if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || 
                tagName === 'h4' || tagName === 'h5' || tagName === 'h6' ||
                tagName === 'strong' || tagName === 'b' || tagName === 'span' ||
                tagName === 'div' || tagName === 'p') {
              element = el;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      
      if (found && element) {
        const styles = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && 
                       styles.display !== 'none' && 
                       styles.visibility !== 'hidden' &&
                       parseFloat(styles.opacity) > 0;
        
        // Get the content after this header
        let contentEl = element.nextElementSibling;
        let contentText = '';
        if (contentEl) {
          contentText = contentEl.textContent?.substring(0, 200) || '';
        }
        
        content.sections.push({
          name: section.name,
          found: true,
          visible: visible,
          headerText: element.textContent?.trim() || '',
          contentPreview: contentText,
          element: {
            tag: element.tagName,
            className: element.className,
            id: element.id,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            styles: {
              display: styles.display,
              visibility: styles.visibility,
              opacity: styles.opacity
            }
          }
        });
      } else {
        content.missingContent.push(section.name);
      }
    });
    
    return content;
  });
  
  // Save HTML
  const finalHtml = await page.content();
  await fs.writeFile(path.join(outDir, `detailed_render_${timestamp}.html`), finalHtml, 'utf-8');
  
  // Save detailed report
  const report = {
    url: liveUrl,
    timestamp,
    screenshotsDir: `screenshots_${timestamp}`,
    htmlFile: `detailed_render_${timestamp}.html`,
    content: pageContent
  };
  
  await fs.writeFile(
    path.join(outDir, `detailed_report_${timestamp}.json`),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  
  console.log('\n=== Content Analysis ===');
  console.log('Title:', pageContent.title);
  console.log('Total headers found:', pageContent.allHeaders.length);
  console.log('Total paragraphs found:', pageContent.allParagraphs.length);
  
  console.log('\n=== Section Status ===');
  pageContent.sections.forEach(section => {
    console.log(`\n${section.name}:`);
    console.log(`  Status: ${section.visible ? 'VISIBLE' : 'HIDDEN'}`);
    console.log(`  Header: "${section.headerText}"`);
    if (section.contentPreview) {
      console.log(`  Content preview: "${section.contentPreview.substring(0, 80)}..."`);
    }
  });
  
  if (pageContent.missingContent.length > 0) {
    console.log('\n=== Missing Sections ===');
    pageContent.missingContent.forEach(name => {
      console.log(`- ${name}`);
    });
  }
  
  console.log('\n=== Files Saved ===');
  console.log(`Report: ${outDir}/detailed_report_${timestamp}.json`);
  console.log(`HTML: ${outDir}/detailed_render_${timestamp}.html`);
  console.log(`Screenshots: ${screenshotDir}/`);
  
} catch (error) {
  console.error('Error during analysis:', error);
} finally {
  await browser.close();
}