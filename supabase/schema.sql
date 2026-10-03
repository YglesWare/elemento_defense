-- Élémento Defense : base Supabase (à coller dans SQL Editor → New query → Run)
-- Sauvegarde en ligne du joueur : une ligne par entrée de progression (clé k), protégée par RLS.

-- Une entrée de progression : la même chose que le magasin « kv » d'IndexedDB (js/storage.js)
create table if not exists public.player_data (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  k text not null,                 -- clé, ex. 'elemento.meta'
  v jsonb,                         -- valeur (null si supprimée)
  domain text not null,            -- profile, progress, stats, save
  at bigint not null,              -- date de modification (ms), pour la fusion « la plus récente gagne »
  del boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

-- Sécurité : chacun ne voit et ne modifie que ses propres lignes
alter table public.player_data enable row level security;

drop policy if exists "player_data: lire les siennes" on public.player_data;
create policy "player_data: lire les siennes" on public.player_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "player_data: ajouter les siennes" on public.player_data;
create policy "player_data: ajouter les siennes" on public.player_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "player_data: modifier les siennes" on public.player_data;
create policy "player_data: modifier les siennes" on public.player_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "player_data: effacer les siennes" on public.player_data;
create policy "player_data: effacer les siennes" on public.player_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Une modification plus ancienne n'écrase jamais une plus récente (deux appareils qui se synchronisent en même temps)
create or replace function public.player_data_keep_newest() returns trigger language plpgsql as $$
begin
  if new.at < old.at then return old; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists player_data_keep_newest on public.player_data;
create trigger player_data_keep_newest before update on public.player_data
  for each row execute function public.player_data_keep_newest();

-- Journal des parties : voir supabase/game_log.sql
