-- Topic metadata table for admin-editable descriptions and SEO texts
create table if not exists public.topic_meta (
  topic        text primary key,
  description     text,
  description_en  text,
  seo_text        text,
  seo_text_en     text,
  seo_keywords    text,
  seo_keywords_en text,
  updated_at      timestamptz not null default now()
);

-- Enable RLS
alter table public.topic_meta enable row level security;

-- Public read
create policy "topic_meta_public_read"
  on public.topic_meta for select
  using (true);

-- Authenticated write (admin)
create policy "topic_meta_service_write"
  on public.topic_meta for all
  using (true)
  with check (true);
