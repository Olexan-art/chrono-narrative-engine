#!/usr/bin/env node

import readline from 'readline'

// Read environment variables directly
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askPassword() {
    return new Promise((resolve) => {
        rl.question('Enter admin password: ', (answer) => {
            resolve(answer);
        });
    });
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase configuration in environment');
    process.exit(1);
}

async function callEdgeFunction(action, data, adminPassword) {
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    
    const payload = {
        action,
        password: adminPassword,
        data
    };

    console.log(`📤 Calling admin/${action}...`);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    return result;
}

async function main() {
    try {
        const ADMIN_PASSWORD = await askPassword();
        rl.close();

        // 1. Disable retell_india jobs
        console.log('\n🔴 Disabling retell_india jobs...');
        
        const disableIndia = await callEdgeFunction('updateCronConfig', {
            jobName: 'retell_india',
            config: { enabled: false }
        }, ADMIN_PASSWORD);
        
        if (disableIndia.success) {
            console.log('✅ retell_india disabled');
        } else {
            console.error('❌ Failed to disable retell_india:', disableIndia.error);
        }

        // 2. Update retell_recent_usa
        console.log('\n🟢 Updating retell_recent_usa configuration...');
        
        const updateUSA = await callEdgeFunction('updateCronConfig', {
            jobName: 'retell_recent_usa',
            config: {
                frequency_minutes: 15
            }
        }, ADMIN_PASSWORD);

        if (updateUSA.success) {
            console.log('✅ retell_recent_usa updated');
            console.log('   - Frequency increased: 30 min → 15 min');
            console.log('   - Will run more frequently to catch newest articles');
        } else {
            console.error('❌ Failed to update retell_recent_usa:', updateUSA.error);
        }

        console.log('\n✨ Configuration update completed!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
