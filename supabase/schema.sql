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
  is_public boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playlists_user_id_idx on public.playlists(user_id);
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
  position integer not null default 0,
  title text not null default '',
  artist text not null default '',
  artwork text not null default '',
  duration integer not null default 0,
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
