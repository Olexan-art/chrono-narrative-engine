-- Create a new storage bucket for news covers
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true);

-- Set up security policies for the 'covers' bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'covers' );

create policy "Authenticated User Upload"
  on storage.objects for insert
  with check ( bucket_id = 'covers' and auth.role() = 'authenticated' );

create policy "Authenticated User Update"
  on storage.objects for update
  using ( bucket_id = 'covers' and auth.role() = 'authenticated' );

create policy "Authenticated User Delete"
  on storage.objects for delete
  using ( bucket_id = 'covers' and auth.role() = 'authenticated' );
