// Мануальний виклик Edge Function для тестування
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';

console.log('🔧 Мануальний тест Edge Function: score-news-source\n');

// Test with Gemini model
console.log('Викликаємо Edge Function з моделлю Gemini (auto_select)...');
const response = await fetch(`${SUPABASE_URL}/functions/v1/score-news-source`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  },
  body: JSON.stringify({
    model: 'gemini-2.5-flash',
    provider: 'gemini',
    auto_select: true
  })
});

console.log('Статус:', response.status, response.statusText);

if (response.ok) {
  const data = await response.json();
  console.log('\n✅ Результат:');
  console.log(JSON.stringify(data, null, 2));
} else {
  const errorText = await response.text();
  console.log('\n❌ Помилка:');
  console.log(errorText);
}
