-- Élémento Defense : multi en ligne entre amis (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer après supabase/friends.sql.
-- Un salon (room) est ouvert par l'hôte ; il invite ses amis (invitation valable 60 s). Les téléphones se trouvent par
-- un canal Supabase Realtime privé « room:<id> », réservé à l'hôte et aux invités qui ont accepté, puis se parlent
-- directement (WebRTC) ; si la liaison directe échoue, les messages du jeu passent par ce même canal.
-- Pas de texte libre : une invitation ne contient que le mode, la carte et la difficulté, vérifiés ici.

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  host uuid not null default auth.uid() references auth.users (id) on delete cascade,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists rooms_host on public.rooms (host) where not closed;
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  room uuid not null references public.rooms (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  info jsonb not null default '{}',     -- { mode: 'duel' | 'coop', map: n, diff: 'facile' | … }
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 seconds'
);
create index if not exists invites_to on public.invites (to_user, status);
create index if not exists invites_room on public.invites (room);
alter table public.rooms enable row level security;
alter table public.invites enable row level security;

-- Deux joueurs sont amis (et aucun n'a bloqué l'autre)
create or replace function public._friends(x uuid, y uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where ((a = x and b = y) or (a = y and b = x)) and status = 'accepted')
     and not exists (select 1 from friendships where ((a = x and b = y) or (a = y and b = x)) and status = 'blocked')
$$;
revoke all on function public._friends(uuid, uuid) from public, anon, authenticated;

-- ---------- Salons ----------
-- Ouvre un salon (le précédent de l'hôte est fermé) ; rend son identifiant
create or replace function public.room_create() returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); r uuid;
begin
  update rooms set closed = true where host = me and not closed;
  update invites set status = 'cancelled' where from_user = me and status = 'pending';
  delete from rooms where host = me and closed and created_at < now() - interval '1 day';
  insert into rooms (host) values (me) returning id into r;
  return r;
end $$;

create or replace function public.room_close(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set closed = true where id = p_room and host = _me();
  update invites set status = 'cancelled' where room = p_room and status = 'pending';
end $$;

-- Membre d'un salon ouvert : l'hôte, ou un invité qui a accepté (sert aux règles du canal Realtime)
create or replace function public.room_member(p_topic text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare rid uuid;
begin
  if p_topic !~ '^room:[0-9a-f-]{36}$' then return false; end if;
  rid := substring(p_topic from 6)::uuid;
  return exists (select 1 from rooms r where r.id = rid and not r.closed and (r.host = auth.uid()
    or exists (select 1 from invites i where i.room = rid and i.to_user = auth.uid() and i.status = 'accepted')));
end $$;

-- ---------- Invitations ----------
-- L'hôte invite un ami dans son salon. Rend l'identifiant de l'invitation, ou une erreur
create or replace function public.invite_send(p_room uuid, p_to uuid, p_mode text, p_map int, p_diff text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); n int; inv uuid;
begin
  if not exists (select 1 from rooms where id = p_room and host = me and not closed) then return json_build_object('err', 'no_room'); end if;
  if not _friends(me, p_to) then return json_build_object('err', 'not_friend'); end if;
  select count(*) into n from invites where from_user = me and created_at > now() - interval '1 minute';
  if n >= 10 then return json_build_object('err', 'too_many'); end if;
  update invites set status = 'cancelled' where room = p_room and to_user = p_to and status = 'pending';
  insert into invites (room, from_user, to_user, info) values (p_room, me, p_to, json_build_object(
    'mode', case when p_mode = 'coop' then 'coop' else 'duel' end,
    'map', greatest(0, least(coalesce(p_map, 0), 99)),
    'diff', case when p_diff in ('facile', 'moyen', 'difficile', 'infini') then p_diff else 'moyen' end)::jsonb)
  returning id into inv;
  return json_build_object('id', inv);
end $$;

-- Mes invitations reçues, encore valables (avec le pseudo et le gardien de l'hôte)
create or replace function public.invites_pending() returns table (id uuid, room uuid, info jsonb, pseudo text, avatar text, secs int)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := _me();
begin
  return query
  select i.id, i.room, i.info, p.pseudo, p.avatar, greatest(0, extract(epoch from i.expires_at - now()))::int
  from invites i join rooms r on r.id = i.room and not r.closed join profiles p on p.user_id = i.from_user
  where i.to_user = me and i.status = 'pending' and i.expires_at > now() and _friends(me, i.from_user)
  order by i.created_at desc;
end $$;

-- Accepter ou refuser. Rend { room } si accepté (et encore valable), sinon { err }
create or replace function public.invite_respond(p_id uuid, p_accept boolean) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); i invites%rowtype;
begin
  select * into i from invites where id = p_id and to_user = me;
  if not found then return json_build_object('err', 'gone'); end if;
  if not p_accept then update invites set status = 'declined' where id = p_id and status = 'pending'; return json_build_object('ok', true); end if;
  if i.status <> 'pending' or i.expires_at < now() or not exists (select 1 from rooms where id = i.room and not closed) then return json_build_object('err', 'expired'); end if;
  -- Une seule partie à la fois : les autres invitations en attente sont refusées
  update invites set status = 'declined' where to_user = me and status = 'pending' and id <> p_id;
  update invites set status = 'accepted' where id = p_id;
  return json_build_object('room', i.room);
end $$;

-- L'hôte suit ses invitations (envoyée, acceptée, refusée, expirée)
create or replace function public.room_invites(p_room uuid) returns table (to_user uuid, status text, secs int)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select distinct on (i.to_user) i.to_user, case when i.status = 'pending' and i.expires_at < now() then 'expired' else i.status end,
    greatest(0, extract(epoch from i.expires_at - now()))::int
  from invites i join rooms r on r.id = i.room and r.host = _me()
  where i.room = p_room
  order by i.to_user, i.created_at desc;
end $$;

create or replace function public.invite_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update invites set status = 'cancelled' where id = p_id and from_user = _me() and status = 'pending';
end $$;

do $$ declare f text; begin
  foreach f in array array['public.room_create()', 'public.room_close(uuid)', 'public.room_member(text)', 'public.invite_send(uuid, uuid, text, int, text)',
    'public.invites_pending()', 'public.invite_respond(uuid, boolean)', 'public.room_invites(uuid)', 'public.invite_cancel(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;

-- ---------- Canal Realtime privé du salon ----------
-- Seuls l'hôte et les invités qui ont accepté peuvent écouter (select) et envoyer (insert) sur « room:<id> »
drop policy if exists "elemento room: recevoir" on realtime.messages;
create policy "elemento room: recevoir" on realtime.messages for select to authenticated
  using (public.room_member(realtime.topic()));
drop policy if exists "elemento room: envoyer" on realtime.messages;
create policy "elemento room: envoyer" on realtime.messages for insert to authenticated
  with check (public.room_member(realtime.topic()));
