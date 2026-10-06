-- Élémento Defense : voir les salons de ses amis et demander à les rejoindre (à coller dans SQL Editor → New query → Run ;
-- se relance sans risque). À lancer après supabase/rooms.sql.
-- L'hôte donne régulièrement l'état de son salon (salon ou partie en cours, mode, carte, nombre de joueurs) ; ses amis le
-- voient dans l'onglet « En ligne ». Un ami demande à entrer ; l'hôte accepte ou refuse (demande valable 30 s). Accepter
-- crée une invitation déjà acceptée : le canal du salon (room_member) laisse alors entrer l'ami, comme avec une invitation.

alter table public.rooms add column if not exists state text not null default 'lobby';
alter table public.rooms add column if not exists info jsonb not null default '{}';
alter table public.rooms add column if not exists players int not null default 1;
alter table public.rooms add column if not exists seen_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_state_check') then
    alter table public.rooms add constraint rooms_state_check check (state in ('lobby', 'game'));
  end if;
end $$;

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  room uuid not null references public.rooms (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 seconds'
);
create index if not exists join_requests_room on public.join_requests (room, status);
create index if not exists join_requests_from on public.join_requests (from_user, created_at);
alter table public.join_requests enable row level security;  -- aucune règle : seulement les fonctions

-- L'hôte dit où en est son salon (toutes les quelques secondes). Seulement des valeurs connues : pas de texte libre.
create or replace function public.room_update(p_room uuid, p_state text, p_mode text, p_map int, p_diff text, p_players int, p_wave int) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set
    state = case when p_state = 'game' then 'game' else 'lobby' end,
    info = json_build_object(
      'mode', case when p_mode = 'coop' then 'coop' else 'duel' end,
      'map', greatest(0, least(coalesce(p_map, 0), 99)),
      'diff', case when p_diff in ('facile', 'moyen', 'difficile', 'infini') then p_diff else 'moyen' end,
      'wave', greatest(0, least(coalesce(p_wave, 0), 9999)))::jsonb,
    players = greatest(1, least(coalesce(p_players, 1), 4)),
    seen_at = now()
  where id = p_room and host = _me() and not closed;
end $$;

-- Les salons ouverts de mes amis, dont l'hôte a donné des nouvelles il y a moins de 45 s
create or replace function public.friend_rooms() returns table (room uuid, pseudo text, avatar text, state text, info jsonb, players int)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := _me();
begin
  return query
  select r.id, p.pseudo, p.avatar, r.state, r.info, r.players
  from rooms r join profiles p on p.user_id = r.host
  where not r.closed and r.host <> me and r.seen_at > now() - interval '45 seconds' and _friends(me, r.host)
  order by (r.state = 'lobby') desc, r.seen_at desc;
end $$;

-- Demander à entrer dans le salon d'un ami. Rend { id } ou { err : gone | started | full | not_friend | too_many }
create or replace function public.room_ask(p_room uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); r rooms%rowtype; n int; q uuid;
begin
  select * into r from rooms where id = p_room;
  if not found or r.closed or r.seen_at < now() - interval '45 seconds' then return json_build_object('err', 'gone'); end if;
  if not _friends(me, r.host) then return json_build_object('err', 'not_friend'); end if;
  if r.state = 'game' then return json_build_object('err', 'started'); end if;
  if r.players >= 4 then return json_build_object('err', 'full'); end if;
  select count(*) into n from join_requests where from_user = me and created_at > now() - interval '1 minute';
  if n >= 6 then return json_build_object('err', 'too_many'); end if;
  update join_requests set status = 'cancelled' where from_user = me and status = 'pending';
  insert into join_requests (room, from_user) values (p_room, me) returning id into q;
  return json_build_object('id', q);
end $$;

-- Où en est ma demande ? Rend { status, room } (status : pending | accepted | declined | expired | cancelled)
create or replace function public.room_ask_status(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare q join_requests%rowtype;
begin
  select * into q from join_requests where id = p_id and from_user = _me();
  if not found then return json_build_object('status', 'cancelled'); end if;
  return json_build_object('status', case when q.status = 'pending' and q.expires_at < now() then 'expired' else q.status end, 'room', q.room);
end $$;

create or replace function public.room_ask_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update join_requests set status = 'cancelled' where id = p_id and from_user = _me() and status = 'pending';
end $$;

-- L'hôte voit les demandes en attente pour son salon (avec le pseudo et le gardien de l'ami)
create or replace function public.room_requests(p_room uuid) returns table (id uuid, pseudo text, avatar text, secs int)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := _me();
begin
  return query
  select q.id, p.pseudo, p.avatar, greatest(0, extract(epoch from q.expires_at - now()))::int
  from join_requests q join rooms r on r.id = q.room and r.host = me and not r.closed join profiles p on p.user_id = q.from_user
  where q.room = p_room and q.status = 'pending' and q.expires_at > now() and _friends(me, q.from_user)
  order by q.created_at;
end $$;

-- L'hôte répond. Accepter crée une invitation déjà acceptée (le canal du salon laisse alors entrer l'ami)
create or replace function public.room_request_respond(p_id uuid, p_accept boolean) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); q join_requests%rowtype;
begin
  select q2.* into q from join_requests q2 join rooms r on r.id = q2.room and r.host = me and not r.closed where q2.id = p_id;
  if not found or q.status <> 'pending' or q.expires_at < now() then return json_build_object('err', 'gone'); end if;
  if not p_accept then update join_requests set status = 'declined' where id = p_id; return json_build_object('ok', true); end if;
  if not _friends(me, q.from_user) then return json_build_object('err', 'not_friend'); end if;
  update invites set status = 'cancelled' where room = q.room and to_user = q.from_user and status = 'pending';
  insert into invites (room, from_user, to_user, info, status) select q.room, me, q.from_user, r.info, 'accepted' from rooms r where r.id = q.room;
  update join_requests set status = 'accepted' where id = p_id;
  return json_build_object('ok', true);
end $$;

do $$ declare f text; begin
  foreach f in array array['public.room_update(uuid, text, text, int, text, int, int)', 'public.friend_rooms()', 'public.room_ask(uuid)',
    'public.room_ask_status(uuid)', 'public.room_ask_cancel(uuid)', 'public.room_requests(uuid)', 'public.room_request_respond(uuid, boolean)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
