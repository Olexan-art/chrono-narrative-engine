import process from 'process';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kdxfcsmbdvhqyajbocxg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function adminRequest(action, data = null) {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD not set');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action,
      password: ADMIN_PASSWORD,
      data
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

async function testRetellQueueAPI() {
  console.log('🧪 Testing new Retell Queue API functions...\n');

  try {
    // Test 1: Get initial queue stats
    console.log('1️⃣ Testing getRetellQueueStats...');
    const statsResult = await adminRequest('getRetellQueueStats');
    console.log('✅ Stats result:', JSON.stringify(statsResult, null, 2));

    // Test 2: Initialize queue
    console.log('\n2️⃣ Testing initRetellQueue...');
    const initResult = await adminRequest('initRetellQueue', { provider: 'both' });
    console.log('✅ Init result:', JSON.stringify(initResult, null, 2));

    // Test 3: Process queue (small batch)
    console.log('\n3️⃣ Testing processRetellQueue...');
    const processResult = await adminRequest('processRetellQueue', { 
      provider: 'both', 
      batch_size: 2, 
      timeout_minutes: 5 
    });
    console.log('✅ Process result:', JSON.stringify(processResult, null, 2));

    // Test 4: Get updated stats
    console.log('\n4️⃣ Testing updated stats after processing...');
    const updatedStatsResult = await adminRequest('getRetellQueueStats');
    console.log('✅ Updated stats result:', JSON.stringify(updatedStatsResult, null, 2));

    console.log('\n🎉 All tests passed! Queue system is working.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    
    if (error.message.includes('HTTP')) {
      console.log('\n💡 Try checking:');
      console.log('  - admin function is deployed to Supabase');
      console.log('  - ADMIN_PASSWORD is correct');
      console.log('  - SUPABASE_SERVICE_ROLE_KEY has proper permissions');
    }
  }
}

testRetellQueueAPI();