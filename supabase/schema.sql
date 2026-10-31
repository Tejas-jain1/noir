-- ============================================================================
-- NOIR Database Schema for Supabase
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. Enable pgcrypto for UUID generation
create extension if not exists pgcrypto;

-- 2. User Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- 3. Playlists Table
create table if not exists public.playlists (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  cover_url text,
  owner_name text,
  source_type text not null default 'noir',
  source_url text,
  spotify_playlist_id text,
  total_track_count integer not null default 0,
  matched_track_count integer not null default 0,
  unmatched_track_count integer not null default 0,
  unavailable_track_count integer not null default 0,
  is_public boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playlists_user_id_idx on public.playlists(user_id);
create unique index if not exists playlists_user_spotify_playlist_uidx
  on public.playlists(user_id, spotify_playlist_id)
  where spotify_playlist_id is not null;
alter table public.playlists enable row level security;

create policy "Users can read their own or public playlists"
  on public.playlists for select using (auth.uid() = user_id or is_public = true);

create policy "Users can insert their own playlists"
  on public.playlists for insert with check (auth.uid() = user_id);

create policy "Users can update their own playlists"
  on public.playlists for update using (auth.uid() = user_id);

create policy "Users can delete their own playlists"
  on public.playlists for delete using (auth.uid() = user_id);

-- 4. Playlist Tracks Table (text track_id supports YouTube IDs)
create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id text not null references public.playlists(id) on delete cascade,
  track_id text not null,
  catalog_track_id text,
  position integer not null default 0,
  title text not null default '',
  artist text not null default '',
  album text not null default '',
  artwork text not null default '',
  duration integer not null default 0,
  duration_ms bigint not null default 0,
  spotify_track_id text,
  spotify_url text,
  match_status text not null default 'native' check (match_status in ('native', 'matched', 'unmatched', 'unavailable')),
  added_at timestamptz not null default now()
);

create index if not exists playlist_tracks_playlist_id_idx on public.playlist_tracks(playlist_id);
create index if not exists playlist_tracks_track_id_idx on public.playlist_tracks(track_id);
alter table public.playlist_tracks enable row level security;

create policy "Users can read tracks of readable playlists"
  on public.playlist_tracks for select using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and (playlists.user_id = auth.uid() or playlists.is_public = true)
    )
  );

create policy "Users can manage tracks in their playlists"
  on public.playlist_tracks for all using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = auth.uid()
    )
  );

-- Atomically upsert a private Spotify import and every source track using the
-- caller's authenticated Supabase session. No service-role key is required.
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

-- 5. Liked Tracks Table
create table if not exists public.liked_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  title text not null default '',
  artist text not null default '',
  artwork text not null default '',
  duration integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create index if not exists liked_tracks_user_id_idx on public.liked_tracks(user_id);
alter table public.liked_tracks enable row level security;

create policy "Users can read their own liked tracks"
  on public.liked_tracks for select using (auth.uid() = user_id);

create policy "Users can insert liked tracks"
  on public.liked_tracks for insert with check (auth.uid() = user_id);

create policy "Users can delete liked tracks"
  on public.liked_tracks for delete using (auth.uid() = user_id);

-- 6. Listening History Table
create table if not exists public.listening_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  title text not null default '',
  artist text not null default '',
  artwork text not null default '',
  duration integer not null default 0,
  progress_ms integer not null default 0,
  played_at timestamptz not null default now()
);

create index if not exists listening_history_user_id_idx on public.listening_history(user_id);
create index if not exists listening_history_played_at_idx on public.listening_history(user_id, played_at desc);
alter table public.listening_history enable row level security;

create policy "Users can read their own history"
  on public.listening_history for select using (auth.uid() = user_id);

create policy "Users can insert their own history"
  on public.listening_history for insert with check (auth.uid() = user_id);

create policy "Users can delete their own history"
  on public.listening_history for delete using (auth.uid() = user_id);

-- 7. Automatic Profile Creation on Signup Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
