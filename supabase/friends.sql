-- Élémento Defense : amis (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- Sécurité enfants : pas de recherche de joueurs. On ajoute un ami seulement avec son code ami, et il doit accepter.
-- Les tables ne sont lisibles par personne depuis le jeu : tout passe par les fonctions ci-dessous, qui ne montrent
-- à chacun que ses amis et ses demandes (pseudo, gardien, présence), jamais les autres joueurs.

create extension if not exists pgcrypto with schema extensions;

-- Profil public… pour ses amis seulement
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  friend_code text not null unique,                     -- 7 chiffres, ex. '4821937' (affiché YGL-482-1937)
  pseudo text not null default 'Joueur' check (char_length(pseudo) between 1 and 12),
  avatar text not null default 'feu' check (avatar ~ '^[a-z]{1,12}$'),  -- gardien affiché à côté du pseudo
  state text not null default 'off' check (state in ('menu', 'game', 'off')),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Une ligne par lien : a a demandé b (pending), ils sont amis (accepted), ou a a bloqué b (blocked)
create table if not exists public.friendships (
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create index if not exists friendships_b on public.friendships (b);
-- Codes faux tapés (anti-devinette : 5 par minute et 20 par jour au plus)
create table if not exists public.code_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists code_attempts_user on public.code_attempts (user_id, at);

-- Aucun accès direct depuis le jeu (RLS activée, aucune règle) : seulement les fonctions
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.code_attempts enable row level security;

-- ---------- Outils internes ----------
create or replace function public._new_friend_code() returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    -- 7 chiffres tirés au hasard (générateur cryptographique), le premier jamais 0 pour qu'il se lise bien
    c := (1000000 + (('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 9000000))::text;
    exit when not exists (select 1 from profiles where friend_code = c);
  end loop;
  return c;
end $$;
revoke all on function public._new_friend_code() from public, anon, authenticated;

create or replace function public._me() returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return auth.uid();
end $$;

-- ---------- Mon profil ----------
-- Crée ou met à jour mon profil (pseudo, gardien) ; rend mon code ami
create or replace function public.profile_sync(p_pseudo text, p_avatar text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); ps text; av text; code text;
begin
  ps := btrim(left(btrim(regexp_replace(coalesce(p_pseudo, ''), '[[:cntrl:]]', '', 'g')), 12));
  if ps = '' then ps := 'Joueur'; end if;
  av := case when p_avatar ~ '^[a-z]{1,12}$' then p_avatar else 'feu' end;
  insert into profiles (user_id, friend_code, pseudo, avatar) values (me, _new_friend_code(), ps, av)
    on conflict (user_id) do update set pseudo = excluded.pseudo, avatar = excluded.avatar;
  select friend_code into code from profiles where user_id = me;
  return json_build_object('code', code);
end $$;

-- Nouveau code ami (l'ancien ne marche plus ; les amis restent)
create or replace function public.friend_new_code() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); code text := _new_friend_code();
begin
  update profiles set friend_code = code where user_id = me;
  return json_build_object('code', code);
end $$;

-- Présence : « menu », « game » (en partie) ou « off »
create or replace function public.presence_ping(p_state text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set last_seen = now(), state = case when p_state in ('menu', 'game', 'off') then p_state else 'menu' end where user_id = _me();
end $$;

-- ---------- Amis ----------
-- Demande d'ami par code. Rend { ok: 'sent' | 'accepted' | 'already', pseudo, avatar } ou { err: … }
create or replace function public.friend_request(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); c text; t profiles%rowtype; n int;
begin
  delete from code_attempts where user_id = me and at < now() - interval '1 day';
  select count(*) into n from code_attempts where user_id = me and at > now() - interval '1 minute';
  if n >= 5 then return json_build_object('err', 'too_many'); end if;
  select count(*) into n from code_attempts where user_id = me;
  if n >= 20 then return json_build_object('err', 'too_many_day'); end if;
  -- Seulement les chiffres : « YGL-482-1937 », « 4821937 » ou « ygl 482 1937 » donnent le même code
  c := right(regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g'), 7);
  select * into t from profiles where friend_code = c;
  if not found then insert into code_attempts (user_id) values (me); return json_build_object('err', 'not_found'); end if;
  if t.user_id = me then return json_build_object('err', 'self'); end if;
  if exists (select 1 from friendships where a = me and b = t.user_id and status = 'blocked') then return json_build_object('err', 'you_blocked'); end if;
  -- Bloqué par l'autre : on fait comme si la demande était partie (il n'est pas prévenu, rien n'est créé)
  if exists (select 1 from friendships where a = t.user_id and b = me and status = 'blocked') then
    return json_build_object('ok', 'sent', 'pseudo', t.pseudo, 'avatar', t.avatar);
  end if;
  if exists (select 1 from friendships where ((a = me and b = t.user_id) or (a = t.user_id and b = me)) and status = 'accepted') then
    return json_build_object('ok', 'already', 'pseudo', t.pseudo, 'avatar', t.avatar);
  end if;
  -- Il m'avait déjà demandé : on devient amis
  if exists (select 1 from friendships where a = t.user_id and b = me and status = 'pending') then
    update friendships set status = 'accepted', created_at = now() where a = t.user_id and b = me;
    return json_build_object('ok', 'accepted', 'pseudo', t.pseudo, 'avatar', t.avatar);
  end if;
  select count(*) into n from friendships where a = me and status = 'pending';
  if n >= 20 then return json_build_object('err', 'too_many'); end if;
  insert into friendships (a, b, status) values (me, t.user_id, 'pending') on conflict (a, b) do nothing;
  return json_build_object('ok', 'sent', 'pseudo', t.pseudo, 'avatar', t.avatar);
end $$;

-- Accepter ou refuser une demande reçue
create or replace function public.friend_respond(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := _me();
begin
  if p_accept then update friendships set status = 'accepted', created_at = now() where a = p_other and b = me and status = 'pending';
  else delete from friendships where a = p_other and b = me and status = 'pending'; end if;
end $$;

-- Retirer un ami (ou annuler une demande envoyée)
create or replace function public.friend_remove(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := _me();
begin
  delete from friendships where ((a = me and b = p_other) or (a = p_other and b = me)) and status in ('pending', 'accepted');
end $$;

-- Bloquer : plus d'amitié, plus de demandes ni d'invitations de sa part (il n'est pas prévenu)
create or replace function public.friend_block(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := _me();
begin
  if not exists (select 1 from friendships where (a = me and b = p_other) or (a = p_other and b = me)) then return; end if;
  delete from friendships where ((a = me and b = p_other) or (a = p_other and b = me)) and status in ('pending', 'accepted');
  insert into friendships (a, b, status) values (me, p_other, 'blocked') on conflict (a, b) do update set status = 'blocked', created_at = now();
end $$;

create or replace function public.friend_unblock(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from friendships where a = _me() and b = p_other and status = 'blocked';
end $$;

-- Ma liste : amis (avec présence), demandes reçues, demandes envoyées, bloqués
create or replace function public.friends_list() returns table (user_id uuid, pseudo text, avatar text, kind text, since timestamptz, online boolean, state text, last_seen timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := _me();
begin
  return query
  select p.user_id, p.pseudo, p.avatar,
    case when f.status = 'accepted' then 'friend' when f.status = 'blocked' then 'blocked' when f.a = me then 'out' else 'in' end,
    f.created_at,
    f.status = 'accepted' and p.state <> 'off' and p.last_seen > now() - interval '100 seconds',
    case when f.status = 'accepted' then p.state else null end,
    case when f.status = 'accepted' then p.last_seen else null end
  from friendships f
  join profiles p on p.user_id = case when f.a = me then f.b else f.a end
  where (f.a = me or f.b = me)
    and not (f.status = 'blocked' and f.b = me)   -- celui qui est bloqué ne voit rien
    and not (f.status = 'pending' and f.b = me and exists (select 1 from friendships x where x.a = me and x.b = f.a and x.status = 'blocked'));
end $$;

-- ---------- Invité → compte Google déjà existant ----------
-- Se connecter avec un compte Google déjà utilisé fait changer de compte : sans ça, les amis de l'invité resteraient
-- sur l'ancien compte. Avant de partir, l'invité reçoit un jeton (gardé sur son appareil) ; une fois connecté, le jeu
-- le rend, et ses amis, son code ami (si le compte n'avait pas encore d'amis) et ses scores passent sur le compte.
-- Puis le compte invité est supprimé (sa progression est déjà sur l'appareil, fusionnée ou remplacée au choix du joueur).
create table if not exists public.account_moves (
  token text primary key,
  from_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.account_moves enable row level security;  -- aucune règle : seulement les fonctions

create or replace function public.account_move_start() returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); t text;
begin
  if not exists (select 1 from auth.users where id = me and is_anonymous) then raise exception 'pas un compte invité'; end if;
  delete from account_moves where from_user = me or created_at < now() - interval '1 day';
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into account_moves (token, from_user) values (t, me);
  return t;
end $$;

-- Interne (et utilisable à la main dans SQL Editor pour réparer un ancien cas) : amis, code ami et scores de p_from vers p_to
create or replace function public._move_account(p_from uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare had boolean; nf int;
begin
  if p_from is null or p_to is null or p_from = p_to then raise exception 'comptes invalides'; end if;
  had := exists (select 1 from friendships where (a = p_to or b = p_to) and a <> p_from and b <> p_from);
  -- Liens d'amitié : l'invité est remplacé par le compte ; pas de doublon, pas d'ami avec soi-même
  insert into friendships (a, b, status, created_at)
    select case when f.a = p_from then p_to else f.a end, case when f.b = p_from then p_to else f.b end, f.status, f.created_at
    from friendships f, lateral (select case when f.a = p_from then f.b else f.a end as other) o
    where (f.a = p_from or f.b = p_from) and o.other <> p_to
      and not exists (select 1 from friendships g where (g.a = p_to and g.b = o.other) or (g.a = o.other and g.b = p_to))
  on conflict do nothing;
  get diagnostics nf = row_count;
  delete from friendships where a = p_from or b = p_from;
  -- Code ami : celui de l'invité est gardé si le compte n'avait pas encore d'amis (ses amis le connaissent)
  if not had and exists (select 1 from profiles where user_id = p_from) then
    delete from profiles where user_id = p_to;
    update profiles set user_id = p_to where user_id = p_from;
  end if;
  -- Scores du jour et des cartes : ceux du compte restent quand les deux existent
  update daily_scores s set user_id = p_to where s.user_id = p_from and not exists (select 1 from daily_scores d where d.user_id = p_to and d.day = s.day and d.diff = s.diff);
  update map_scores s set user_id = p_to where s.user_id = p_from and not exists (select 1 from map_scores d where d.user_id = p_to and d.map = s.map and d.diff = s.diff);
  return jsonb_build_object('amis', nf);
end $$;
revoke all on function public._move_account(uuid, uuid) from public, anon, authenticated;

create or replace function public.account_move_finish(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); src uuid; r jsonb;
begin
  delete from account_moves where token = p_token and created_at > now() - interval '1 day' returning from_user into src;
  if src is null then raise exception 'jeton expiré'; end if;
  if src = me then return '{}'::jsonb; end if;
  if not exists (select 1 from auth.users where id = src and is_anonymous) then raise exception 'compte invité introuvable'; end if;
  r := _move_account(src, me);
  delete from auth.users where id = src;
  return r;
end $$;

-- Seuls les joueurs connectés (comptes anonymes compris) peuvent appeler ces fonctions
do $$ declare f text; begin
  foreach f in array array['public._me()', 'public.profile_sync(text, text)', 'public.friend_new_code()', 'public.presence_ping(text)', 'public.friend_request(text)',
    'public.friend_respond(uuid, boolean)', 'public.friend_remove(uuid)', 'public.friend_block(uuid)', 'public.friend_unblock(uuid)', 'public.friends_list()',
    'public.account_move_start()', 'public.account_move_finish(text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;

-- Anciens codes (lettres et chiffres, première version de ce script) : remplacés par 7 chiffres
update public.profiles set friend_code = public._new_friend_code() where friend_code !~ '^[1-9][0-9]{6}$';
