-- Élémento Defense : renforcement de la sécurité (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer en dernier, après tous les autres scripts (friends, rooms, rooms_join, maps, tournament, admin, game_log, ad_log,
-- errors, mp_log). Il remplace quelques fonctions par une version plus sûre et ajoute des garde-fous :
--   1. Codes amis : limite d'essais aussi par adresse IP (des centaines de comptes invités ne suffisent plus à deviner),
--      au plus 10 demandes en attente chez un même joueur, et un inconnu n'est montré que par son code ami
--      (jamais par le pseudo qu'il a choisi) tant que la demande n'est pas acceptée. Une adresse IP qui tape 25 codes faux
--      d'affilée (sans un seul bon code entre deux) ne peut plus ajouter d'amis pendant 7 jours (table ip_blocks).
--   2. Pseudo : gros mots, adresses e-mail, liens, numéros et réseaux sociaux refusés aussi par le serveur,
--      « Ygles » réservé au créateur.
--   3. Salons en ligne : un canal par invité (« room:<salon>:<invité> »), où seuls l'hôte et cet invité parlent ;
--      un ami bloqué ou retiré ne peut plus entrer ; room_close ne touche que son propre salon.
--   4. Tournoi : la marge d'un match ne se réécrit plus, et seul un joueur du match peut le voir ; 30 rapports par jour.
--   5. Base : taille et nombre de lignes plafonnés pour la sauvegarde, les journaux et les scores des cartes.
-- À régler aussi dans le tableau de bord Supabase (ce script ne peut pas le faire) :
--   - Realtime → Settings : décocher « Allow public access » (seuls les canaux privés, protégés par ces règles).
--   - Authentication → Rate Limits : baisser « anonymous sign-ins » (5 par heure et par IP).
--   - Authentication → Attack Protection : CAPTCHA laissé coupé (le jeu n'envoie pas de jeton : l'activer bloquerait
--     la création des comptes) ; les limites ci-dessus et ip_blocks suffisent.
--   - Authentication → Providers → Email : garder « Confirm email » activé.

-- ---------- 1. Codes amis ----------
alter table public.code_attempts add column if not exists ip text;
create index if not exists code_attempts_ip on public.code_attempts (ip, at);
create index if not exists code_attempts_at on public.code_attempts (at);
alter table public.code_attempts add column if not exists ok boolean not null default false;  -- bon code (coupe la série de codes faux)

-- Adresses IP bloquées pour l'ajout d'amis (trop de codes faux d'affilée). Elles se voient et se débloquent dans
-- admin.html (section « Adresses IP bloquées »).
create table if not exists public.ip_blocks (
  ip text primary key,
  until timestamptz not null,
  attempts int not null default 0,
  at timestamptz not null default now()
);
alter table public.ip_blocks enable row level security;  -- aucune règle : seulement les fonctions

-- Pour admin.html : les blocages (en cours d'abord), et le déblocage, noté dans le registre des actions
alter table public.admin_log drop constraint if exists admin_log_action_check;
alter table public.admin_log add constraint admin_log_action_check check (action in ('export', 'delete', 'admin_add', 'admin_remove', 'self_delete', 'flag_set', 'setting_set', 'ip_unblock'));
create or replace function public.admin_ip_blocks() returns table (ip text, attempts int, at timestamptz, until timestamptz, active boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  return query select b.ip, b.attempts, b.at, b.until, b.until > now() from ip_blocks b
    where b.until > now() - interval '30 days' order by b.until > now() desc, b.at desc limit 200;
end $$;
-- Débloquer une adresse : sa série de codes faux repart de zéro (sinon le prochain code faux la rebloquerait)
create or replace function public.admin_ip_unblock(p_ip text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin() then raise exception 'réservé aux administrateurs'; end if;
  delete from ip_blocks where ip = p_ip;
  if not found then return 'absent'; end if;
  delete from code_attempts where ip = p_ip;
  insert into admin_log (admin, action, note) values (auth.uid(), 'ip_unblock', p_ip);
  return 'ok';
end $$;
revoke all on function public.admin_ip_blocks() from public, anon;
grant execute on function public.admin_ip_blocks() to authenticated;
revoke all on function public.admin_ip_unblock(text) from public, anon;
grant execute on function public.admin_ip_unblock(text) to authenticated;

-- Adresse IP de l'appel (donnée par la passerelle Supabase) ; null si inconnue
create or replace function public._req_ip() returns text language sql stable set search_path = public as $$
  select nullif(btrim(split_part(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-forwarded-for', h ->> 'x-real-ip', ''), ',', 1)), '')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) x
$$;
revoke all on function public._req_ip() from public, anon, authenticated;

-- Un code ami lisible : « YGL-482-1937 »
create or replace function public._fmt_code(c text) returns text language sql immutable set search_path = public as $$
  select 'YGL-' || left(c, 3) || '-' || substr(c, 4)
$$;
revoke all on function public._fmt_code(text) from public, anon, authenticated;

-- Demande d'ami par code. Rend { ok: 'sent' | 'accepted' | 'already', pseudo, avatar } ou { err: … }
-- Pour une demande envoyée, « pseudo » est le code ami tapé : celui qui devine un code n'apprend rien sur le joueur.
create or replace function public.friend_request(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); my_ip text := _req_ip(); c text; t profiles%rowtype; n int;
begin
  delete from code_attempts where at < now() - interval '1 day';
  if my_ip is not null and exists (select 1 from ip_blocks b where b.ip = my_ip and b.until > now()) then return json_build_object('err', 'blocked'); end if;
  select count(*) into n from code_attempts a where a.user_id = me and not a.ok and a.at > now() - interval '1 minute';
  if n >= 5 then return json_build_object('err', 'too_many'); end if;
  select count(*) into n from code_attempts a where a.user_id = me and not a.ok;
  if n >= 20 then return json_build_object('err', 'too_many_day'); end if;
  -- Même limite pour tous les comptes d'une même adresse (une école ou une famille partagent la leur : plus large)
  if my_ip is not null then
    select count(*) into n from code_attempts a where a.ip = my_ip and not a.ok and a.at > now() - interval '1 minute';
    if n >= 10 then return json_build_object('err', 'too_many'); end if;
    select count(*) into n from code_attempts a where a.ip = my_ip and not a.ok;
    if n >= 40 then return json_build_object('err', 'too_many_day'); end if;
  end if;
  -- Seulement les chiffres : « YGL-482-1937 », « 4821937 » ou « ygl 482 1937 » donnent le même code
  c := right(regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g'), 7);
  select * into t from profiles where friend_code = c;
  if not found then
    insert into code_attempts (user_id, ip) values (me, my_ip);
    -- 25 codes faux d'affilée depuis cette adresse (sur 24 h, sans bon code entre deux) : bloquée 7 jours
    if my_ip is not null then
      select count(*) into n from code_attempts a where a.ip = my_ip and not a.ok
        and a.at > coalesce((select max(b.at) from code_attempts b where b.ip = my_ip and b.ok), '-infinity'::timestamptz);
      if n >= 25 then
        insert into ip_blocks (ip, until, attempts) values (my_ip, now() + interval '7 days', n)
          on conflict (ip) do update set until = excluded.until, attempts = excluded.attempts, at = now();
      end if;
    end if;
    return json_build_object('err', 'not_found');
  end if;
  -- Un bon code coupe la série de codes faux de cette adresse
  if my_ip is not null then insert into code_attempts (user_id, ip, ok) values (me, my_ip, true); end if;
  if t.user_id = me then return json_build_object('err', 'self'); end if;
  if exists (select 1 from friendships where a = me and b = t.user_id and status = 'blocked') then return json_build_object('err', 'you_blocked'); end if;
  -- Bloqué par l'autre : on fait comme si la demande était partie (il n'est pas prévenu, rien n'est créé)
  if exists (select 1 from friendships where a = t.user_id and b = me and status = 'blocked') then
    return json_build_object('ok', 'sent', 'pseudo', _fmt_code(c));
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
  -- Pas plus de 10 demandes en attente chez un même joueur : les suivantes font comme si elles étaient parties
  select count(*) into n from friendships where b = t.user_id and status = 'pending';
  if n < 10 then insert into friendships (a, b, status) values (me, t.user_id, 'pending') on conflict (a, b) do nothing; end if;
  return json_build_object('ok', 'sent', 'pseudo', _fmt_code(c));
end $$;

-- Ma liste : amis (avec présence), demandes reçues, demandes envoyées, bloqués.
-- Seuls les amis sont montrés avec leur pseudo et leur gardien ; les autres le sont par leur code ami (« YGL-482-1937 ») :
-- un inconnu ne peut pas se faire passer pour « Papa » ou « Maîtresse » dans une demande.
create or replace function public.friends_list() returns table (user_id uuid, pseudo text, avatar text, kind text, since timestamptz, online boolean, state text, last_seen timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := _me();
begin
  return query
  select p.user_id,
    case when f.status = 'accepted' then p.pseudo else _fmt_code(p.friend_code) end,
    case when f.status = 'accepted' then p.avatar else null end,
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

-- ---------- 2. Pseudo ----------
-- Même filtre que le jeu (js/friends.js, badPseudo) : un jeu modifié ne peut plus poser un pseudo grossier
create or replace function public._bad_pseudo(p text) returns boolean language plpgsql immutable set search_path = public as $$
declare
  n text; flat text; w text;
  roots text[] := array['merde', 'putain', 'pute', 'salope', 'salaud', 'connard', 'connasse', 'encul', 'batard', 'bite', 'couille', 'chier', 'nique', 'niquer',
    'pede', 'tapette', 'gouine', 'negre', 'bougnoul', 'youpin', 'nazi', 'hitler', 'fuck', 'shit', 'bitch', 'dick', 'cock', 'pussy', 'cunt', 'asshole', 'nigg',
    'faggot', 'slut', 'whore', 'porn', 'sexe', 'sexy', 'teub', 'chatte', 'zizi', 'penis', 'vagin', 'branle', 'suce', 'nichon', 'bordel', 'crotte', 'caca', 'pipi', 'prout'];
  words text[] := array['pd', 'fdp', 'ntm', 'tg', 'con', 'cul', 'sex', 'zob', 'ass', 'fag', 'wtf', 'kkk', 'ss'];
begin
  n := translate(lower(coalesce(p, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa');
  -- Pas de moyen de contact : adresse e-mail, lien, numéro de téléphone, réseau social
  if regexp_replace(n, '\s+', '', 'g') ~ ('@|://|www|https?|\.(com|fr|net|org|io|be|ch|ca|ly|gg|tv|me|co|uk|de|es|it|eu|info|xyz|app|link|gl|to|sh)(\M|$)|[0-9]{5,}'
    || '|snap|insta|tiktok|discord|whatsapp|wats?ap|telegram|messenger|youtube|twitch|gmail|hotmail|outlook|yahoo') then return true; end if;
  n := translate(n, '0134@5$7', 'oieaasst');
  flat := regexp_replace(n, '[^a-z]', '', 'g');
  foreach w in array roots loop if position(w in flat) > 0 then return true; end if; end loop;
  if flat = any (words) then return true; end if;
  foreach w in array regexp_split_to_array(n, '[^a-z]+') loop if w = any (words) then return true; end if; end loop;
  return false;
end $$;
revoke all on function public._bad_pseudo(text) from public, anon, authenticated;

-- Crée ou met à jour mon profil (pseudo, gardien) ; rend mon code ami
create or replace function public.profile_sync(p_pseudo text, p_avatar text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); ps text; av text; code text;
begin
  -- Caractères de contrôle et caractères invisibles ou de sens d'écriture retirés
  ps := btrim(left(btrim(regexp_replace(coalesce(p_pseudo, ''), '[[:cntrl:]​-‏‪-‮⁠-⁩﻿]', '', 'g')), 12));
  if ps = '' or _bad_pseudo(ps) then ps := 'Joueur'; end if;
  -- « Ygles » (et ses variantes) : réservé au créateur du jeu
  if translate(regexp_replace(lower(ps), '[^a-z0-9]', '', 'g'), '0134', 'oiea') like '%ygles%' and not _is_admin() then ps := 'Joueur'; end if;
  av := case when p_avatar ~ '^[a-z]{1,12}$' then p_avatar else 'feu' end;
  insert into profiles (user_id, friend_code, pseudo, avatar) values (me, _new_friend_code(), ps, av)
    on conflict (user_id) do update set pseudo = excluded.pseudo, avatar = excluded.avatar;
  select friend_code into code from profiles where user_id = me;
  return json_build_object('code', code);
end $$;
-- Les pseudos déjà enregistrés passent au même filtre
update public.profiles set pseudo = 'Joueur' where public._bad_pseudo(pseudo)
  or (translate(regexp_replace(lower(pseudo), '[^a-z0-9]', '', 'g'), '0134', 'oiea') like '%ygles%' and user_id not in (select user_id from public.admins));

-- ---------- 3. Salons en ligne ----------
create or replace function public.room_close(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where id = p_room and host = _me()) then return; end if;
  update rooms set closed = true where id = p_room;
  update invites set status = 'cancelled' where room = p_room and status = 'pending';
end $$;

-- Qui peut écouter et parler sur un canal Realtime :
--   « room:<salon>:<invité> » (version 138 et suivantes) : seulement l'hôte et cet invité, s'il a accepté une invitation et
--   qu'ils sont toujours amis. Chaque message y vient donc forcément de l'un des deux : personne ne peut se faire passer
--   pour l'hôte ou pour un autre invité.
--   « room:<salon> » (anciennes versions) : l'hôte et les invités qui ont accepté, toujours amis avec l'hôte.
create or replace function public.room_member(p_topic text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare rid uuid; gid uuid; me uuid := auth.uid();
begin
  if me is null then return false; end if;
  if p_topic ~ '^room:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
    rid := substring(p_topic from 6 for 36)::uuid; gid := substring(p_topic from 43)::uuid;
    if me <> gid and not exists (select 1 from rooms where id = rid and host = me) then return false; end if;
    return exists (select 1 from rooms r where r.id = rid and not r.closed and r.host <> gid and _friends(r.host, gid)
      and exists (select 1 from invites i where i.room = rid and i.to_user = gid and i.status = 'accepted'));
  end if;
  if p_topic !~ '^room:[0-9a-f-]{36}$' then return false; end if;
  rid := substring(p_topic from 6)::uuid;
  return exists (select 1 from rooms r where r.id = rid and not r.closed and (r.host = me
    or (_friends(r.host, me) and exists (select 1 from invites i where i.room = rid and i.to_user = me and i.status = 'accepted'))));
end $$;

-- ---------- 4. Tournoi ----------
-- Un téléphone envoie le résultat de son duel. Rend { ok: 'counted' | 'not_counted' | 'pending' | 'mismatch', id, month, phase, pts } ou { err }
create or replace function public.tour_report(p_mid text, p_opp uuid, p_result text, p_margin int, p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := _me(); o tour_reports%rowtype; m tour_matches%rowtype; w uuid; mg int; rs text; nm text; np int; n int; fresh int;
begin
  if p_mid is null or char_length(p_mid) not between 8 and 40 or p_result not in ('win', 'loss', 'draw') then return json_build_object('err', 'bad'); end if;
  if p_opp is null or p_opp = me or not _friends(me, p_opp) then return json_build_object('err', 'not_friend'); end if;
  select count(*) into n from tour_reports where reporter = me and created_at > now() - interval '1 day';
  if n >= 30 then return json_build_object('err', 'too_many'); end if;
  insert into tour_reports (mid, reporter, opp, result, margin, reason)
    values (p_mid, me, p_opp, p_result, case when p_margin between 0 and 99 then p_margin end, case when p_reason = 'net' then 'net' else 'ko' end)
    on conflict (mid, reporter) do nothing;
  get diagnostics fresh = row_count;
  -- Déjà compté (l'autre a envoyé avant) : seulement si je suis l'un des deux joueurs de ce match
  select * into m from tour_matches where mid = p_mid;
  if found then
    if me not in (m.a, m.b) or p_opp not in (m.a, m.b) then return json_build_object('err', 'bad'); end if;
    -- Le gagnant donne sa marge une seule fois (premier rapport), quand le perdant a déclaré le match avant lui
    if fresh = 1 and m.winner = me and p_result = 'win' and p_margin between 0 and 99 then update tour_matches set margin = greatest(1, p_margin) where id = m.id; end if;
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
create index if not exists tour_reports_reporter on public.tour_reports (reporter, created_at);

-- ---------- 5. Taille de la base ----------
-- Journaux (parties, multi, pubs, erreurs) : une ligne trop grosse, ou plus de 200 lignes par heure pour un joueur,
-- est ignorée sans erreur (le jeu ne renvoie pas en boucle). Arguments : taille maximale (octets), lignes par heure.
create or replace function public._log_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if octet_length(row_to_json(new)::text) > TG_ARGV[0]::int then return null; end if;
  execute format('select count(*) from %I.%I where user_id = $1 and created_at > now() - interval ''1 hour''', TG_TABLE_SCHEMA, TG_TABLE_NAME) into n using new.user_id;
  if n >= TG_ARGV[1]::int then return null; end if;
  return new;
end $$;
revoke all on function public._log_guard() from public, anon, authenticated;

do $$ declare t text; lim text; begin
  foreach t in array array['game_log:12000', 'mp_log:4000', 'ad_log:2000', 'client_errors:4000'] loop
    lim := split_part(t, ':', 2); t := split_part(t, ':', 1);
    if to_regclass('public.' || t) is null then raise notice 'Table % absente : lance d''abord son script', t; continue; end if;
    execute format('create index if not exists %I on public.%I (user_id, created_at)', t || '_user_at', t);
    execute format('drop trigger if exists %I on public.%I', t || '_guard', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public._log_guard(%L, %L)', t || '_guard', t, lim, '200');
  end loop;
end $$;

-- Sauvegarde : 256 Ko au plus par entrée, 3 Mo et 300 entrées au plus par joueur (une vraie progression en fait bien moins)
create or replace function public._player_data_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare tot bigint; n int;
begin
  if char_length(new.k) > 80 or new.domain not in ('profile', 'progress', 'stats', 'save', 'local') then return null; end if;
  if coalesce(octet_length(new.v::text), 0) > 262144 then return null; end if;
  select coalesce(sum(pg_column_size(v)), 0), count(*) into tot, n from player_data where user_id = new.user_id and k <> new.k;
  if tot + coalesce(pg_column_size(new.v), 0) > 3145728 or n >= 300 then return null; end if;
  return new;
end $$;
revoke all on function public._player_data_guard() from public, anon, authenticated;
drop trigger if exists player_data_guard on public.player_data;
create trigger player_data_guard before insert or update on public.player_data
  for each row execute function public._player_data_guard();

-- Scores des cartes : 300 cartes au plus par joueur
create or replace function public.map_submit(p_map text, p_diff text, p_score int, p_mult real, p_chal jsonb, p_wave int, p_won boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := _me();
begin
  if p_map !~ '^[a-z0-9_-]{1,30}$' or p_diff not in ('facile', 'moyen', 'difficile', 'infini') then return; end if;
  if jsonb_typeof(coalesce(p_chal, '{}'::jsonb)) <> 'object' or length(coalesce(p_chal, '{}'::jsonb)::text) > 400 then p_chal := '{}'::jsonb; end if;
  if not exists (select 1 from map_scores where user_id = me and map = p_map and diff = p_diff)
    and (select count(*) from map_scores where user_id = me) >= 300 then return; end if;
  insert into map_scores (user_id, map, diff, score, mult, chal, wave, won)
  values (me, p_map, p_diff, greatest(0, least(coalesce(p_score, 0), 99999999)), greatest(0.3, least(coalesce(p_mult, 1), 3)), coalesce(p_chal, '{}'::jsonb),
    greatest(0, least(coalesce(p_wave, 0), 9999)), coalesce(p_won, false))
  on conflict (user_id, map, diff) do update set score = excluded.score, mult = excluded.mult, chal = excluded.chal, wave = excluded.wave, won = excluded.won, at = now()
  where excluded.score > map_scores.score;
end $$;
