-- Add United Kingdom to news_countries
INSERT INTO public.news_countries (code, name, name_en, name_pl, flag, is_active, sort_order, retell_ratio)
VALUES ('GB', 'Велика Британія', 'United Kingdom', 'Wielka Brytania', '🇬🇧', true, 2, 100)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  name_pl = EXCLUDED.name_pl,
  flag = EXCLUDED.flag,
  is_active = true,
  retell_ratio = 100;