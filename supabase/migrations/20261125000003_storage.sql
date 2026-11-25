-- =====================================================================
-- Supabase Storage: bucket privado "user-files".
-- Convenção de caminho: {user_id}/{pasta}/{arquivo}
-- Cada usuária só lê/escreve dentro da própria pasta.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-files', 'user-files', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain'])
on conflict (id) do nothing;

create policy "arquivos_proprios_select" on storage.objects for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_proprios_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_proprios_update" on storage.objects for update to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_proprios_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
