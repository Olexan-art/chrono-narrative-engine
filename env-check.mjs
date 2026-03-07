import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
console.log('=== .env first 600 chars ===');
console.log(JSON.stringify(env.slice(0, 600)));
console.log('--- lines ---');
env.split('\n').slice(0, 15).forEach((line, i) => console.log(i, JSON.stringify(line)));
