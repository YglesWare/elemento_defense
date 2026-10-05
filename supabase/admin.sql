-- Élémento Defense : traitement des demandes RGPD (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer après tous les autres scripts (sauf ad_log.sql, qui vient juste après). Réservé aux administrateurs (table admins) : retrouver un joueur,
-- exporter toutes ses données, supprimer son compte, ouvrir les fonctions en bêta, changer les réglages du jeu. Utilisé par la page admin.html du site.
--
-- Pour te déclarer administrateur, une fois connecté au moins une fois avec Google sur admin.html :
--   insert into public.admins (user_id) select id from auth.users where email = 'yglesware@gmail.com' on conflict do nothing;

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;  -- aucune règle : seulement les fonctions

-- Registre des actions (preuve qu'une demande a été traitée)
create table if not exists public.admin_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  admin uuid,
  action text not null,
  target uuid,
  note text
);
alter table public.admin_log enable row level security;
alter table public.admin_log drop constraint if exists admin_log_action_check;
alter table public.admin_log add constraint admin_log_action_check check (action in ('export', 'delete', 'admin_add', 'admin_remove', 'self_delete', 'flag_set', 'setting_set'));

create or replace function public._is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
revoke all on function public._is_admin() from public, anon, authenticated;

-- Suis-je administrateur ? (la page s'en sert pour savoir quoi afficher)
create or replace function public.admin_whoami() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', auth.uid(), 'admin', _is_admin())
$$;

-- Retrouver un joueur : code ami (YGL-482-1937 ou 4821937), identifiant de progression (7D08-EE30),
-- adresse e-mail (compte Google), pseudo, ou identifiant de compte
create or replace function public.admin_find(p_q text)
returns table (user_id uuid, pseudo text, friend_code text, progress_id text, email text, providers jsonb, anonymous boolean,
  created_at timestamptz, last_seen timestamptz, games bigint)
language plpgsql stable security definer set search_path = public as $$
declare q text := btrim(coalesce(p_q, '')); digits text; hex text;
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  if char_length(q) < 2 then return; end if;
  digits := regexp_replace(q, '[^0-9]', '', 'g');
  hex := lower(regexp_replace(q, '[^0-9a-fA-F]', '', 'g'));
  return query
  with ids as (
    select u.id from auth.users u where q ~* '^[0-9a-f-]{36}$' and u.id = q::uuid
    union select u.id from auth.users u where position('@' in q) > 0 and u.email ilike q
    union select p.user_id from profiles p where char_length(digits) = 7 and p.friend_code = digits
    union select d.user_id from player_data d where char_length(hex) >= 6 and d.k = 'elemento.playerId'
      and replace(lower(d.v #>> '{}'), '-', '') like hex || '%'
    union select g.user_id from game_log g where char_length(hex) >= 6 and g.user_id is not null and replace(lower(g.player_id), '-', '') like hex || '%'
    union select p.user_id from profiles p where position('@' in q) = 0 and p.pseudo ilike '%' || q || '%'
  )
  select u.id, p.pseudo, p.friend_code,
    (select d.v #>> '{}' from player_data d where d.user_id = u.id and d.k = 'elemento.playerId'),
    u.email::text, u.raw_app_meta_data -> 'providers', coalesce(u.is_anonymous, false),
    u.created_at, p.last_seen, (select count(*) from game_log g where g.user_id = u.id)
  from ids join auth.users u on u.id = ids.id left join profiles p on p.user_id = u.id
  order by p.last_seen desc nulls last
  limit 25;
end $$;

-- Toutes les données d'un joueur, en un seul document (droit d'accès et de portabilité)
create or replace function public.admin_export(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  select jsonb_build_object(
    'jeu', 'Élémento Defense', 'exporte_le', now(),
    'compte', (select jsonb_build_object('id', u.id, 'email', u.email, 'cree_le', u.created_at, 'derniere_connexion', u.last_sign_in_at,
      'anonyme', coalesce(u.is_anonymous, false), 'connexions', u.raw_app_meta_data -> 'providers',
      'nom', u.raw_user_meta_data ->> 'full_name', 'photo', u.raw_user_meta_data ->> 'avatar_url') from auth.users u where u.id = p_user),
    'profil', (select to_jsonb(p) - 'user_id' from profiles p where p.user_id = p_user),
    'sauvegarde', (select coalesce(jsonb_agg(jsonb_build_object('cle', d.k, 'valeur', d.v, 'domaine', d.domain, 'modifie_le', d.updated_at) order by d.k), '[]') from player_data d where d.user_id = p_user and not d.del),
    'amis', (select coalesce(jsonb_agg(jsonb_build_object('code_ami', pr.friend_code, 'statut', f.status, 'depuis', f.created_at)), '[]')
      from friendships f left join profiles pr on pr.user_id = case when f.a = p_user then f.b else f.a end where f.a = p_user or f.b = p_user),
    'invitations', (select coalesce(jsonb_agg(jsonb_build_object('envoyee', i.from_user = p_user, 'info', i.info, 'statut', i.status, 'le', i.created_at)), '[]') from invites i where i.from_user = p_user or i.to_user = p_user),
    'scores_carte_du_jour', (select coalesce(jsonb_agg(to_jsonb(s) - 'user_id'), '[]') from daily_scores s where s.user_id = p_user),
    'scores_cartes', (select coalesce(jsonb_agg(to_jsonb(s) - 'user_id'), '[]') from map_scores s where s.user_id = p_user),
    'journal_des_parties', (select coalesce(jsonb_agg(to_jsonb(g) - 'user_id' order by g.at), '[]') from game_log g where g.user_id = p_user),
    'journal_des_pubs', (select coalesce(jsonb_agg(to_jsonb(a) - 'user_id' order by a.at), '[]') from ad_log a where a.user_id = p_user),
    'rapports_techniques', (select coalesce(jsonb_agg(to_jsonb(e) - 'user_id'), '[]') from client_errors e where e.user_id = p_user)
  ) into r;
  insert into admin_log (admin, action, target) values (auth.uid(), 'export', p_user);
  return r;
end $$;

-- Suppression du compte (droit à l'effacement) : la sauvegarde, le profil, les amis, les invitations et les scores
-- disparaissent avec le compte ; les journaux (parties, pubs) et les rapports techniques restent, mais anonymes (plus de compte)
create or replace function public.admin_delete(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  if p_user = auth.uid() or exists (select 1 from admins where user_id = p_user) then raise exception 'impossible de supprimer un administrateur'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'compte introuvable'; end if;
  select jsonb_build_object(
    'sauvegarde', (select count(*) from player_data where user_id = p_user),
    'profil', (select count(*) from profiles where user_id = p_user),
    'amis', (select count(*) from friendships where a = p_user or b = p_user),
    'scores', (select count(*) from daily_scores where user_id = p_user) + (select count(*) from map_scores where user_id = p_user),
    'parties_anonymisees', (select count(*) from game_log where user_id = p_user),
    'rapports_anonymises', (select count(*) from client_errors where user_id = p_user)) into r;
  delete from auth.users where id = p_user;   -- tout le reste suit (on delete cascade / set null)
  insert into admin_log (admin, action, target, note) values (auth.uid(), 'delete', p_user, r::text);
  return r;
end $$;

-- Gestion des administrateurs (réservée aux administrateurs) : la personne doit s'être connectée une fois avec Google sur admin.html
create or replace function public.admin_list() returns table (user_id uuid, email text, added_at timestamptz, me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  return query select a.user_id, u.email::text, a.added_at, a.user_id = auth.uid() from admins a join auth.users u on u.id = a.user_id order by a.added_at;
end $$;
create or replace function public.admin_add(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email)) and not coalesce(is_anonymous, false) limit 1;
  if uid is null then raise exception 'aucun compte avec cette adresse : la personne doit d''abord se connecter une fois avec Google sur cette page'; end if;
  insert into admins (user_id) values (uid) on conflict do nothing;
  insert into admin_log (admin, action, target) values (auth.uid(), 'admin_add', uid);
  return 'ok';
end $$;
create or replace function public.admin_remove(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  if p_user = auth.uid() then raise exception 'tu ne peux pas te retirer toi-même'; end if;
  if (select count(*) from admins) <= 1 then raise exception 'il faut garder au moins un administrateur'; end if;
  delete from admins where user_id = p_user;
  insert into admin_log (admin, action, target) values (auth.uid(), 'admin_remove', p_user);
  return 'ok';
end $$;

-- Le joueur supprime lui-même son compte (bouton « Supprimer mon compte » du jeu, exigé par Google Play) :
-- même effet que admin_delete, noté dans le registre
create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb;
begin
  if uid is null then raise exception 'pas connecté'; end if;
  if exists (select 1 from admins where user_id = uid) then raise exception 'un administrateur doit d''abord se retirer de la liste des administrateurs'; end if;
  select jsonb_build_object('sauvegarde', (select count(*) from player_data where user_id = uid), 'amis', (select count(*) from friendships where a = uid or b = uid),
    'parties_anonymisees', (select count(*) from game_log where user_id = uid)) into r;
  delete from auth.users where id = uid;
  insert into admin_log (admin, action, target, note) values (null, 'self_delete', uid, r::text);
  return r;
end $$;

-- Fonctions en bêta : chacune est coupée (off), réservée aux administrateurs (admins) ou ouverte à tout le monde (all).
-- Le jeu les lit avec flags_get (js/cloud.js) ; une fonction absente ou inconnue est coupée.
-- Pour en ajouter une : une ligne dans l'insert ci-dessous, puis la vérifier dans le jeu avec flagOn('clé').
create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label text not null,
  mode text not null default 'off' check (mode in ('off', 'admins', 'all')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.feature_flags enable row level security;  -- aucune règle : seulement les fonctions
insert into public.feature_flags (key, label, mode) values
  ('ads', 'Vidéos à récompense (boutons de pub : fin de partie, cartes, défis du jour, K.O.)', 'admins')
on conflict (key) do update set label = excluded.label;

-- Pour le joueur connecté : { "ads": true, … }
create or replace function public.flags_get() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, mode = 'all' or (mode = 'admins' and _is_admin())), '{}'::jsonb) from feature_flags
$$;
create or replace function public.admin_flags() returns table (key text, label text, mode text, updated_at timestamptz, by_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  return query select f.key, f.label, f.mode, f.updated_at, u.email::text from feature_flags f left join auth.users u on u.id = f.updated_by order by f.key;
end $$;
create or replace function public.admin_flag_set(p_key text, p_mode text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  if p_mode not in ('off', 'admins', 'all') then raise exception 'mode inconnu'; end if;
  update feature_flags set mode = p_mode, updated_at = now(), updated_by = auth.uid() where key = p_key;
  if not found then raise exception 'fonction inconnue'; end if;
  insert into admin_log (admin, action, note) values (auth.uid(), 'flag_set', p_key || ' = ' || p_mode);
  return 'ok';
end $$;
revoke all on function public.flags_get() from public;
grant execute on function public.flags_get() to anon, authenticated;

-- Réglages du jeu : des nombres que la page admin.html change sans nouvelle version (ex. le maximum de pubs par jour).
-- Le jeu les lit avec settings_get (js/cloud.js) et garde sa valeur par défaut tant qu'il n'a rien reçu.
-- Pour en ajouter un : une ligne dans l'insert ci-dessous, puis la lire dans le jeu avec setting('clé', défaut).
create table if not exists public.game_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label text not null,
  value int not null,
  min_v int not null default 0,
  max_v int not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.game_settings enable row level security;  -- aucune règle : seulement les fonctions
insert into public.game_settings (key, label, value, min_v, max_v) values
  ('ads_max', 'Pubs à récompense : maximum par jour et par joueur (tous emplacements)', 10, 0, 30),
  ('ads_map_max', 'Pubs à récompense : maximum par jour sur l''écran des cartes (B)', 3, 0, 10)
on conflict (key) do update set label = excluded.label, min_v = excluded.min_v, max_v = excluded.max_v;

create or replace function public.settings_get() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from game_settings
$$;
create or replace function public.admin_settings() returns table (key text, label text, value int, min_v int, max_v int, updated_at timestamptz, by_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  return query select g.key, g.label, g.value, g.min_v, g.max_v, g.updated_at, u.email::text from game_settings g left join auth.users u on u.id = g.updated_by order by g.key;
end $$;
create or replace function public.admin_setting_set(p_key text, p_value int) returns text
language plpgsql security definer set search_path = public as $$
declare r game_settings;
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  select * into r from game_settings where game_settings.key = p_key;
  if not found then raise exception 'réglage inconnu'; end if;
  if p_value is null or p_value < r.min_v or p_value > r.max_v then raise exception 'valeur entre % et %', r.min_v, r.max_v; end if;
  update game_settings set value = p_value, updated_at = now(), updated_by = auth.uid() where game_settings.key = p_key;
  insert into admin_log (admin, action, note) values (auth.uid(), 'setting_set', p_key || ' = ' || p_value);
  return 'ok';
end $$;
revoke all on function public.settings_get() from public;
grant execute on function public.settings_get() to anon, authenticated;

do $$ declare f text; begin
  foreach f in array array['public.delete_my_account()', 'public.admin_whoami()', 'public.admin_find(text)', 'public.admin_export(uuid)', 'public.admin_delete(uuid)', 'public.admin_list()', 'public.admin_add(text)', 'public.admin_remove(uuid)', 'public.admin_flags()', 'public.admin_flag_set(text, text)', 'public.admin_settings()', 'public.admin_setting_set(text, int)'] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
