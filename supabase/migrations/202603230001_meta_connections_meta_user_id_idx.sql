-- Speed up Meta Data Deletion Callback lookups by Facebook user id
create index if not exists meta_connections_meta_user_id_idx
  on public.meta_connections (meta_user_id)
  where meta_user_id is not null;
