
-- Enable RLS on storage.buckets just in case (usually enabled by default)
-- alter table storage.buckets enable row level security;

-- ALLOW EVERYONE to see the buckets list (fixes "Bucket not found" for anon/authenticated)
drop policy if exists "Public Access Buckets" on storage.buckets;
create policy "Public Access Buckets"
  on storage.buckets for select
  using ( true );

-- ALLOW UPLOADS for covers bucket
-- We'll try a very permissive policy first to debugging, then you can restrict it
drop policy if exists "Public Upload Covers" on storage.objects;
create policy "Public Upload Covers"
  on storage.objects for insert
  with check ( bucket_id = 'covers' );

-- ALLOW UPDATE/DELETE for authenticated users
drop policy if exists "Auth Update Covers" on storage.objects;
create policy "Auth Update Covers"
  on storage.objects for update
  using ( bucket_id = 'covers' and auth.role() = 'authenticated' );

drop policy if exists "Auth Delete Covers" on storage.objects;
create policy "Auth Delete Covers"
  on storage.objects for delete
  using ( bucket_id = 'covers' and auth.role() = 'authenticated' );
