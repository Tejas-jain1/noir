-- Spotify playlist metadata and track outcomes, scoped by the existing user_id.
alter table public.playlists
  add column if not exists source_type text not null default 'noir',
  add column if not exists source_url text,
  add column if not exists owner_name text,
  add column if not exists spotify_playlist_id text,
  add column if not exists total_track_count integer not null default 0,
  add column if not exists matched_track_count integer not null default 0,
  add column if not exists unmatched_track_count integer not null default 0,
  add column if not exists unavailable_track_count integer not null default 0;

create unique index if not exists playlists_user_spotify_playlist_uidx
  on public.playlists(user_id, spotify_playlist_id)
  where spotify_playlist_id is not null;

alter table public.playlist_tracks
  add column if not exists album text not null default '',
  add column if not exists catalog_track_id text,
  add column if not exists duration_ms bigint not null default 0,
  add column if not exists spotify_track_id text,
  add column if not exists spotify_url text,
  add column if not exists match_status text not null default 'native';

alter table public.playlist_tracks
  drop constraint if exists playlist_tracks_match_status_check;
alter table public.playlist_tracks
  add constraint playlist_tracks_match_status_check
  check (match_status in ('native', 'matched', 'unmatched', 'unavailable'));

create or replace function public.import_spotify_playlist(p_playlist jsonb, p_tracks jsonb)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_playlist_id text;
  v_spotify_playlist_id text := nullif(p_playlist->>'spotify_playlist_id', '');
begin
  if v_user_id is null then
    raise exception 'Sign in to save an imported playlist.' using errcode = '42501';
  end if;
  if v_spotify_playlist_id is null then
    raise exception 'A Spotify playlist ID is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tracks) is distinct from 'array' then
    raise exception 'Playlist tracks must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_tracks) > 10000 then
    raise exception 'This playlist exceeds the import limit.' using errcode = '22023';
  end if;

  insert into public.playlists (
    id, user_id, name, description, cover_url, owner_name, source_type, source_url,
    spotify_playlist_id, total_track_count, matched_track_count,
    unmatched_track_count, unavailable_track_count, is_public, updated_at
  ) values (
    coalesce(nullif(p_playlist->>'id', ''), 'pl-' || gen_random_uuid()::text),
    v_user_id,
    coalesce(nullif(p_playlist->>'name', ''), 'Imported Spotify Playlist'),
    coalesce(p_playlist->>'description', ''),
    nullif(p_playlist->>'cover_url', ''),
    nullif(p_playlist->>'owner_name', ''),
    'spotify',
    nullif(p_playlist->>'source_url', ''),
    v_spotify_playlist_id,
    greatest(0, coalesce(nullif(p_playlist->>'total_track_count', '')::integer, jsonb_array_length(p_tracks))),
    greatest(0, coalesce(nullif(p_playlist->>'matched_track_count', '')::integer, 0)),
    greatest(0, coalesce(nullif(p_playlist->>'unmatched_track_count', '')::integer, 0)),
    greatest(0, coalesce(nullif(p_playlist->>'unavailable_track_count', '')::integer, 0)),
    false,
    now()
  )
  on conflict (user_id, spotify_playlist_id) where spotify_playlist_id is not null do update set
    name = excluded.name,
    description = excluded.description,
    cover_url = excluded.cover_url,
    owner_name = excluded.owner_name,
    source_type = 'spotify',
    source_url = excluded.source_url,
    total_track_count = excluded.total_track_count,
    matched_track_count = excluded.matched_track_count,
    unmatched_track_count = excluded.unmatched_track_count,
    unavailable_track_count = excluded.unavailable_track_count,
    is_public = false,
    updated_at = now()
  returning id into v_playlist_id;

  delete from public.playlist_tracks where playlist_id = v_playlist_id;

  insert into public.playlist_tracks (
    playlist_id, track_id, catalog_track_id, position, title, artist, album, artwork, duration,
    duration_ms, spotify_track_id, spotify_url, match_status
  )
  select
    v_playlist_id,
    coalesce(nullif(track->>'track_id', ''), 'spotify:' || coalesce(nullif(track->>'spotify_track_id', ''), ordinal::text)),
    nullif(track->>'catalog_track_id', ''),
    (ordinal - 1)::integer,
    coalesce(track->>'title', ''),
    coalesce(track->>'artist', ''),
    coalesce(track->>'album', ''),
    coalesce(track->>'artwork', ''),
    greatest(0, coalesce(nullif(track->>'duration', '')::integer, 0)),
    greatest(0, coalesce(nullif(track->>'duration_ms', '')::bigint, 0)),
    nullif(track->>'spotify_track_id', ''),
    nullif(track->>'spotify_url', ''),
    case when track->>'match_status' in ('matched', 'unmatched', 'unavailable') then track->>'match_status' else 'unmatched' end
  from jsonb_array_elements(p_tracks) with ordinality as rows(track, ordinal);

  return v_playlist_id;
end;
$$;

revoke all on function public.import_spotify_playlist(jsonb, jsonb) from public, anon;
grant execute on function public.import_spotify_playlist(jsonb, jsonb) to authenticated;
