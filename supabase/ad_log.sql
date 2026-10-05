-- Élémento Defense : journal des pubs à récompense (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer après admin.sql. Une ligne par réponse du joueur à une pub, pour voir quels emplacements et quels gains
-- marchent (section « Pubs » de admin.html). Rien de personnel : l'emplacement, la réponse, le gain, la carte.
-- Comme game_log : le joueur peut seulement ajouter ses lignes ; si son compte est supprimé, elles deviennent anonymes.
-- Le revenu, lui, se lit dans AdMob (il n'est connu que de Google).

create table if not exists public.ad_log (
  id uuid primary key,                -- créé par le jeu : un envoi répété ne fait pas de doublon
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  player_id text,                     -- identifiant de progression (regroupe les lignes d'un joueur)
  at bigint not null,                 -- moment de la réponse (ms)
  build int, app text,                -- version du jeu, 'apk' ou 'web'
  test boolean,                       -- pub d'essai (avant AdMob) ou vraie pub
  kind text not null,                 -- 'shards' (fin de partie), 'map' (cartes), 'chest' (défis du jour), 'revive' (K.O.)
  outcome text not null,              -- 'seen' (bouton affiché, 1re fois du jour), 'no' (refus), 'done' (vue), 'skip' (fermée avant la fin), 'err' (pas de pub)
  amount int, unit text,              -- gain proposé : 24 'shards', 150 'gold', 5 'lives'
  day_n int,                          -- pubs déjà vues ce jour-là avant celle-ci
  map text, diff text, wave int,      -- la partie concernée (fin de partie et K.O.)
  created_at timestamptz not null default now()
);
create index if not exists ad_log_at on public.ad_log (at);

alter table public.ad_log enable row level security;
drop policy if exists "ad_log: ajouter les siennes" on public.ad_log;
create policy "ad_log: ajouter les siennes" on public.ad_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Résumé pour admin.html : par emplacement sur les p_days derniers jours (sans les pubs d'essai si p_real)
create or replace function public.admin_ad_stats(p_days int default 30, p_real boolean default false)
returns table (kind text, seen bigint, asked bigint, done bigint, skipped bigint, refused bigint, errors bigint, players bigint, gain bigint, unit text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  return query
  select a.kind,
    count(*) filter (where a.outcome = 'seen'),
    count(*) filter (where a.outcome <> 'seen'),
    count(*) filter (where a.outcome = 'done'),
    count(*) filter (where a.outcome = 'skip'),
    count(*) filter (where a.outcome = 'no'),
    count(*) filter (where a.outcome = 'err'),
    count(distinct a.player_id) filter (where a.outcome = 'done'),
    coalesce(sum(a.amount) filter (where a.outcome = 'done'), 0)::bigint,
    max(a.unit)
  from ad_log a
  where a.created_at > now() - make_interval(days => greatest(1, least(p_days, 365))) and (not p_real or not coalesce(a.test, true))
  group by a.kind order by a.kind;
end $$;
-- Pubs vues par jour (toutes positions confondues)
create or replace function public.admin_ad_days(p_days int default 30, p_real boolean default false)
returns table (day date, done bigint, players bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  return query
  select (a.created_at at time zone 'Europe/Paris')::date, count(*), count(distinct a.player_id)
  from ad_log a
  where a.outcome = 'done' and a.created_at > now() - make_interval(days => greatest(1, least(p_days, 365))) and (not p_real or not coalesce(a.test, true))
  group by 1 order by 1 desc;
end $$;
revoke all on function public.admin_ad_stats(int, boolean) from public, anon;
grant execute on function public.admin_ad_stats(int, boolean) to authenticated;
revoke all on function public.admin_ad_days(int, boolean) from public, anon;
grant execute on function public.admin_ad_days(int, boolean) to authenticated;
