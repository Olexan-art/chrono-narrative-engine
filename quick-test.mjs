import { createClient } from '@supabase/supabase-js';

console.log('⚡ Швидкий тест таблиць');

const supabase = createClient(
  'https://tuledxqigzufkecztnlo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0'
);

// Швидкий тест
supabase.from('settings').select('count', { count: 'exact', head: true })
  .then(r => console.log('Settings count:', r.count || 'error'))
  .catch(e => console.log('Settings error:', e.message));

supabase.from('news').select('count', { count: 'exact', head: true })
  .then(r => console.log('News count:', r.count || 'error'))
  .catch(e => console.log('News error:', e.message));

setTimeout(() => process.exit(0), 8000); // вихід через 8 секунд