-- Élémento Defense : tournoi du mois entre amis (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer après supabase/friends.sql et supabase/rooms.sql (il utilise _me() et _friends()).
-- Chaque duel 1 contre 1 « À zéro » entre deux amis connectés est envoyé par les DEUX téléphones (tour_report) ;
-- il ne compte que s'ils sont d'accord (ou si le perdant le déclare lui-même). Matchs aller du 1er au 15, retour du 16
-- à la fin du mois (heure de Paris) : un seul match compte par paire d'amis et par phase. Victoire 3 points, nul 1,
-- défaite 0 ; « goal average » : les vies restantes du gagnant. Après une coupure réseau, le perdant peut demander à
-- rejouer : si l'autre accepte, le match est effacé. Les tables ne sont lisibles par personne : tout passe par les fonctions.

create table if not exists public.tour_reports (
  mid text not null check (char_length(mid) between 8 and 40),        -- identifiant du duel, tiré par l'hôte
  reporter uuid not null references auth.users (id) on delete cascade,
  opp uuid not null references auth.users (id) on delete cascade,
  result text not null check (result in ('win', 'loss', 'draw')),
  margin int check (margin between 0 and 99),                          -- vies restantes (le gagnant seulement)
  reason text not null default 'ko' check (reason in ('ko', 'net')),   -- net : coupure réseau ou appli quittée
  created_at timestamptz not null default now(),
  primary key (mid, reporter)
);
create table if not exists public.tour_matches (
  id uuid primary key default gen_random_uuid(),
  mid text not null unique,
  month text not null,                                                 -- 'AAAA-MM'
  phase int not null check (phase in (1, 2)),                          -- 1 : aller (1-15), 2 : retour (16-fin)
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  winner uuid,                                                         -- null : match nul
  margin int not null default 1,
  reason text not null default 'ko' check (reason in ('ko', 'net')),
  status text not null default 'counted' check (status in ('counted', 'replay_asked', 'cancelled')),
  asked_at timestamptz,                                                -- demande de revanche (une seule par match)
  refused boolean not null default false,
  created_at timestamptz not null default now(),
  check (a <> b)
);
create index if not exists tour_matches_month on public.tour_matches (month, a, b);
alter table public.tour_reports enable row level security;
alter table public.tour_matches enable row level security;

-- Mois et phase en cours, à l'heure de Paris
create or replace function public._tour_now() returns table (month text, phase int, phase_end date)
language sql stable set search_path = public as $$
  with t as (select (now() at time zone 'Europe/Paris')::date as d)
  select to_char(d, 'YYYY-MM'), case when extract(day from d) <= 15 then 1 else 2 end,
    case when extract(day from d) <= 15 then date_trunc('month', d)::date + 14 else (date_trunc('month', d) + interval '1 month - 1 day')::date end
  from t
$$;

-- Un téléphone envoie le résultat de son duel. Rend { ok: 'counted' | 'not_counted' | 'pending' | 'mismatch', id, month, phase, pts } ou { err }
create or replace function public.tour_report(p_mid text, p_opp uuid, p_result text, p_margin int, p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); o tour_reports%rowtype; m tour_matches%rowtype; w uuid; mg int; rs text; nm text; np int;
begin
  if p_mid is null or char_length(p_mid) not between 8 and 40 or p_result not in ('win', 'loss', 'draw') then return json_build_object('err', 'bad'); end if;
  if p_opp is null or p_opp = me or not _friends(me, p_opp) then return json_build_object('err', 'not_friend'); end if;
  insert into tour_reports (mid, reporter, opp, result, margin, reason)
    values (p_mid, me, p_opp, p_result, case when p_margin between 0 and 99 then p_margin end, case when p_reason = 'net' then 'net' else 'ko' end)
    on conflict (mid, reporter) do nothing;
  -- Déjà compté (l'autre a envoyé avant) : le gagnant complète la marge si elle manquait
  select * into m from tour_matches where mid = p_mid;
  if found then
    if m.winner = me and p_result = 'win' and p_margin between 0 and 99 then update tour_matches set margin = greatest(1, p_margin) where id = m.id; end if;
    return json_build_object('ok', case when m.status = 'cancelled' then 'not_counted' else 'counted' end, 'id', m.id, 'month', m.month, 'phase', m.phase,
      'pts', case when m.winner is null then 1 when m.winner = me then 3 else 0 end);
  end if;
  select * into o from tour_reports where mid = p_mid and reporter = p_opp and opp = me;
  if found then
    if not ((p_result = 'win' and o.result = 'loss') or (p_result = 'loss' and o.result = 'win') or (p_result = 'draw' and o.result = 'draw')) then
      return json_build_object('ok', 'mismatch');
    end if;
    w := case when p_result = 'win' then me when o.result = 'win' then p_opp end;
    mg := case when w is null then 0 when w = me then coalesce(p_margin, o.margin, 1) else coalesce(o.margin, p_margin, 1) end;
    rs := case when p_reason = 'net' or o.reason = 'net' then 'net' else 'ko' end;
  elsif p_result = 'loss' then
    -- Le perdant le déclare lui-même : ça compte tout de suite (la marge viendra avec le rapport du gagnant)
    w := p_opp; mg := 1; rs := case when p_reason = 'net' then 'net' else 'ko' end;
  else
    return json_build_object('ok', 'pending');
  end if;
  select t.month, t.phase into nm, np from _tour_now() t;
  -- Un seul match compté par paire et par phase
  if exists (select 1 from tour_matches where month = nm and phase = np and status <> 'cancelled' and ((a = me and b = p_opp) or (a = p_opp and b = me))) then
    insert into tour_matches (mid, month, phase, a, b, winner, margin, reason, status) values (p_mid, nm, np, me, p_opp, w, greatest(case when w is null then 0 else 1 end, mg), rs, 'cancelled');
    return json_build_object('ok', 'not_counted', 'month', nm, 'phase', np);
  end if;
  insert into tour_matches (mid, month, phase, a, b, winner, margin, reason) values (p_mid, nm, np, me, p_opp, w, greatest(case when w is null then 0 else 1 end, mg), rs)
    returning * into m;
  return json_build_object('ok', 'counted', 'id', m.id, 'month', nm, 'phase', np, 'pts', case when w is null then 1 when w = me then 3 else 0 end);
end $$;

-- Le perdant d'un match coupé par le réseau demande à le rejouer (une seule fois, pendant le mois du match)
create or replace function public.tour_replay_ask(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); m tour_matches%rowtype;
begin
  select * into m from tour_matches where id = p_id;
  if not found or me not in (m.a, m.b) or m.winner is null or m.winner = me then return json_build_object('err', 'not_yours'); end if;
  if m.reason <> 'net' or m.status <> 'counted' or m.asked_at is not null then return json_build_object('err', 'no'); end if;
  if m.month <> (select month from _tour_now()) then return json_build_object('err', 'too_late'); end if;
  update tour_matches set status = 'replay_asked', asked_at = now() where id = p_id;
  return json_build_object('ok', true);
end $$;

-- Le gagnant répond : accepter efface le match (on peut le rejouer), refuser le garde. Sans réponse en 2 jours, il reste.
create or replace function public.tour_replay_answer(p_id uuid, p_accept boolean) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); m tour_matches%rowtype;
begin
  select * into m from tour_matches where id = p_id;
  if not found or m.winner is distinct from me or m.status <> 'replay_asked' then return json_build_object('err', 'no'); end if;
  if m.asked_at < now() - interval '2 days' then update tour_matches set status = 'counted', refused = true where id = p_id; return json_build_object('err', 'expired'); end if;
  update tour_matches set status = case when p_accept then 'cancelled' else 'counted' end, refused = not p_accept where id = p_id;
  return json_build_object('ok', true);
end $$;

-- Le tournoi vu par moi : classement entre moi et mes amis (seulement leurs matchs entre eux), mes matchs, les demandes
create or replace function public.tour_board(p_month text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); nm text; np int; pe date; mo text;
begin
  select t.month, t.phase, t.phase_end into nm, np, pe from _tour_now() t;
  mo := coalesce(nullif(p_month, ''), nm);
  if mo !~ '^[0-9]{4}-[0-9]{2}$' then return json_build_object('err', 'bad'); end if;
  return (
    with circle as (
      select me as id
      union select case when f.a = me then f.b else f.a end from friendships f
        where (f.a = me or f.b = me) and f.status = 'accepted' and _friends(f.a, f.b)
    ),
    ms as (
      select * from tour_matches t where t.month = mo and t.status <> 'cancelled' and t.a in (select id from circle) and t.b in (select id from circle)
    ),
    tab as (
      select c.id,
        count(m.id) as j,
        count(m.id) filter (where m.winner = c.id) as v,
        count(m.id) filter (where m.winner is null) as n,
        count(m.id) filter (where m.winner is not null and m.winner <> c.id) as d,
        coalesce(sum(case when m.winner = c.id then m.margin when m.winner is null then 0 else -m.margin end), 0) as diff
      from circle c left join ms m on c.id in (m.a, m.b)
      group by c.id
    )
    select json_build_object(
      'month', mo, 'current', mo = nm, 'phase', case when mo = nm then np else 2 end, 'phase_end', case when mo = nm then pe end,
      'me', me,
      'players', coalesce((select json_agg(json_build_object('id', r.id, 'pseudo', coalesce(p.pseudo, 'Joueur'), 'avatar', coalesce(p.avatar, 'feu'),
          'j', r.j, 'v', r.v, 'n', r.n, 'd', r.d, 'diff', r.diff, 'pts', r.v * 3 + r.n)
          order by r.v * 3 + r.n desc, r.diff desc, r.v desc, coalesce(p.pseudo, '')) from tab r left join profiles p on p.user_id = r.id
        where r.j > 0 or r.id = me), '[]'::json),
      'friends', coalesce((select json_agg(json_build_object('id', c.id, 'pseudo', coalesce(p.pseudo, 'Joueur'), 'avatar', coalesce(p.avatar, 'feu')) order by coalesce(p.pseudo, ''))
        from circle c left join profiles p on p.user_id = c.id where c.id <> me), '[]'::json),
      'matches', coalesce((select json_agg(json_build_object('id', m.id, 'opp', case when m.a = me then m.b else m.a end, 'phase', m.phase,
          'res', case when m.winner is null then 'draw' when m.winner = me then 'win' else 'loss' end, 'margin', m.margin, 'reason', m.reason,
          'status', case when m.status = 'replay_asked' and m.asked_at < now() - interval '2 days' then 'counted' else m.status end,
          'asked', m.asked_at is not null, 'refused', m.refused) order by m.created_at)
        from tour_matches m where m.month = mo and me in (m.a, m.b) and m.status <> 'cancelled'), '[]'::json)
    )
  );
end $$;

do $$ declare f text; begin
  foreach f in array array['public.tour_report(text, uuid, text, int, text)', 'public.tour_replay_ask(uuid)', 'public.tour_replay_answer(uuid, boolean)', 'public.tour_board(text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
revoke all on function public._tour_now() from public, anon, authenticated;
