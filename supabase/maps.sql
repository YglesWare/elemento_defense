-- Élémento Defense : classement des cartes entre amis, avec les défis (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer après supabase/friends.sql. Chacun envoie son meilleur score par carte et par difficulté (défis compris) ;
-- on ne voit que ses amis. Le réglage des défis est gardé avec le score, pour pouvoir « relever le défi » d'un ami.

create table if not exists public.map_scores (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  map text not null check (map ~ '^[a-z0-9_-]{1,30}$'),   -- identifiant de la carte (prairie, volcan, halloween…)
  diff text not null check (diff in ('facile', 'moyen', 'difficile', 'infini')),
  score int not null default 0,                             -- score final, multiplicateur des défis compris
  mult real not null default 1 check (mult between 0.3 and 3),
  chal jsonb not null default '{}'::jsonb,                  -- réglage des défis (des nombres seulement, relus par le jeu)
  wave int not null default 0,
  won boolean not null default false,
  at timestamptz not null default now(),
  primary key (user_id, map, diff)
);
alter table public.map_scores enable row level security;  -- aucune règle : seulement les fonctions

-- Envoie un résultat ; on garde le meilleur score
create or replace function public.map_submit(p_map text, p_diff text, p_score int, p_mult real, p_chal jsonb, p_wave int, p_won boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := _me();
begin
  if p_map !~ '^[a-z0-9_-]{1,30}$' or p_diff not in ('facile', 'moyen', 'difficile', 'infini') then return; end if;
  if jsonb_typeof(coalesce(p_chal, '{}'::jsonb)) <> 'object' or length(coalesce(p_chal, '{}'::jsonb)::text) > 400 then p_chal := '{}'::jsonb; end if;
  insert into map_scores (user_id, map, diff, score, mult, chal, wave, won)
  values (me, p_map, p_diff, greatest(0, least(coalesce(p_score, 0), 99999999)), greatest(0.3, least(coalesce(p_mult, 1), 3)), coalesce(p_chal, '{}'::jsonb),
    greatest(0, least(coalesce(p_wave, 0), 9999)), coalesce(p_won, false))
  on conflict (user_id, map, diff) do update set score = excluded.score, mult = excluded.mult, chal = excluded.chal, wave = excluded.wave, won = excluded.won, at = now()
  where excluded.score > map_scores.score;
end $$;

-- Classement de toutes les cartes : moi et mes amis (pseudo, gardien, meilleur score par carte et difficulté)
create or replace function public.map_board() returns table (user_id uuid, me boolean, pseudo text, avatar text, map text, diff text, score int, mult real, chal jsonb, wave int, won boolean)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := _me();
begin
  return query
  select s.user_id, s.user_id = uid, p.pseudo, p.avatar, s.map, s.diff, s.score, s.mult, s.chal, s.wave, s.won
  from map_scores s join profiles p on p.user_id = s.user_id
  where s.user_id = uid or _friends(uid, s.user_id);
end $$;

do $$ declare f text; begin
  foreach f in array array['public.map_submit(text, text, int, real, jsonb, int, boolean)', 'public.map_board()'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
