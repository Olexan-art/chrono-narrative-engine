// Test that new blocks are present on deployed site
import { chromium } from 'playwright';

const BLOCKS_TO_CHECK = [
  { name: 'Verified Badge', selector: '[data-section="verified-badge"]' },
  { name: 'Source', selector: '[data-section="source"]' },
  { name: 'Mentioned Entities', selector: '[data-section="mentioned-entities"]' },
  { name: 'Cartoons', selector: '[data-section="cartoon"]' },
  { name: 'Keywords Visual', selector: '[data-section="keywords-visual"]' },
  { name: 'Key Takeaways', selector: '[data-section="key-takeaways"]' },
  { name: 'Topics Nav', selector: '[data-section="topics-nav"]' },
  { name: 'Retelling', selector: '[data-section="retelling"]' },
  { name: 'Why It Matters', selector: '[data-section="why-it-matters"]' },
  { name: 'Context & Background', selector: '[data-section="context-background"]' },
  { name: 'What Happens Next', selector: '[data-section="what-happens-next"]' },
  { name: 'FAQ', selector: '[data-section="faq"]' },
  { name: 'More News About', selector: '[data-section="more-news-about"]' },
  { name: 'Entity Graph', selector: '[data-section="entity-graph"]' }
];

async function testNewBlocks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Use a direct news article URL for testing
    const articleUrl = 'https://bravennow.com/news/us/russian-president-vladimir-putin-announced-key-priorities-for-russia';
    console.log(`\nTesting article: ${articleUrl}\n`);
    
    // Navigate to the article
    await page.goto(articleUrl);
    await page.waitForLoadState('networkidle');
    
    // Check each block
    console.log('Checking for new content blocks:\n');
    const results = { found: 0, missing: 0 };
    
    for (const block of BLOCKS_TO_CHECK) {
      const exists = await page.locator(block.selector).count() > 0;
      
      if (exists) {
        console.log(`✅ ${block.name.padEnd(25)} - FOUND`);
        results.found++;
      } else {
        console.log(`❌ ${block.name.padEnd(25)} - MISSING`);
        results.missing++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Summary: ${results.found}/${BLOCKS_TO_CHECK.length} blocks found`);
    console.log('='.repeat(50));
    
    // Test with cache parameter
    console.log('\nTesting with cache=true...\n');
    await page.goto(articleUrl + '?cache=true');
    await page.waitForLoadState('networkidle');
    
    const cacheResults = { found: 0, missing: 0 };
    
    for (const block of BLOCKS_TO_CHECK) {
      const exists = await page.locator(block.selector).count() > 0;
      
      if (exists) {
        cacheResults.found++;
      } else {
        cacheResults.missing++;
      }
    }
    
    console.log(`Cache results: ${cacheResults.found}/${BLOCKS_TO_CHECK.length} blocks found`);
    
    if (results.found === BLOCKS_TO_CHECK.length && cacheResults.found === BLOCKS_TO_CHECK.length) {
      console.log('\n✅ All blocks successfully deployed and cached!');
    } else {
      console.log('\n⚠️ Some blocks are still missing. May need to wait for cache to update.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testNewBlocks();