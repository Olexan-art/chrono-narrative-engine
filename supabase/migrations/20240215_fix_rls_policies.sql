
-- Fix storage policies for 'covers' bucket
-- Allow public inserts (or at least authenticated) for now to unblock upload
drop policy if exists "Authenticated User Upload" on storage.objects;
create policy "Authenticated User Upload"
  on storage.objects for insert
  with check ( bucket_id = 'covers' AND auth.role() = 'authenticated' );

-- Ensure public can view
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'covers' );

-- Fix wiki_entities policies
-- Allow service_role to do anything (it usually bypasses RLS, but just in case)
alter table wiki_entities enable row level security;
alter table news_wiki_entities enable row level security;

-- Allow authenticated users to insert/update wiki entities (needed if logic runs client-side or if function context is user)
create policy "Authenticated Insert Wiki"
  on wiki_entities for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated Update Wiki"
  on wiki_entities for update
  using ( auth.role() = 'authenticated' );

create policy "Authenticated Insert NewsWiki"
  on news_wiki_entities for insert
  with check ( auth.role() = 'authenticated' );

-- Allow public read
create policy "Public Read Wiki"
  on wiki_entities for select
  using ( true );

create policy "Public Read NewsWiki"
  on news_wiki_entities for select
  using ( true );
