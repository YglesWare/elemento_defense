-- Élémento Defense : classement de la carte du jour entre amis (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer après supabase/friends.sql. Chacun envoie son meilleur résultat du jour par difficulté ; on ne voit que ses amis.

create table if not exists public.daily_scores (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day text not null check (day ~ '^[0-9]{8}$'),       -- AAAAMMJJ (date locale du joueur)
  diff text not null check (diff in ('facile', 'moyen', 'difficile', 'infini')),
  won boolean not null default false,
  wave int not null default 0,
  score int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, day, diff)
);
create index if not exists daily_scores_day on public.daily_scores (day);
alter table public.daily_scores enable row level security;  -- aucune règle : seulement les fonctions

-- Envoie un résultat ; on garde le meilleur (victoire, puis vague, puis score)
create or replace function public.daily_submit(p_day text, p_diff text, p_won boolean, p_wave int, p_score int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); d date;
begin
  if p_day !~ '^[0-9]{8}$' or p_diff not in ('facile', 'moyen', 'difficile', 'infini') then return; end if;
  d := to_date(p_day, 'YYYYMMDD');
  if d < current_date - 2 or d > current_date + 1 then return; end if;     -- fuseaux horaires et synchro tardive
  insert into daily_scores (user_id, day, diff, won, wave, score) values (me, p_day, p_diff, coalesce(p_won, false), greatest(0, least(coalesce(p_wave, 0), 999)), greatest(0, least(coalesce(p_score, 0), 9999999)))
  on conflict (user_id, day, diff) do update set won = excluded.won, wave = excluded.wave, score = excluded.score, at = now()
  where (excluded.won, excluded.wave, excluded.score) > (daily_scores.won, daily_scores.wave, daily_scores.score);
  delete from daily_scores where user_id = me and to_date(day, 'YYYYMMDD') < current_date - 30;
end $$;

-- Classement d'un jour : moi et mes amis (pseudo, gardien, résultat par difficulté)
create or replace function public.daily_board(p_day text) returns table (user_id uuid, me boolean, pseudo text, avatar text, diff text, won boolean, wave int, score int)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := _me();
begin
  return query
  select s.user_id, s.user_id = uid, p.pseudo, p.avatar, s.diff, s.won, s.wave, s.score
  from daily_scores s join profiles p on p.user_id = s.user_id
  where s.day = p_day and (s.user_id = uid or _friends(uid, s.user_id));
end $$;

do $$ declare f text; begin
  foreach f in array array['public.daily_submit(text, text, boolean, int, int)', 'public.daily_board(text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
