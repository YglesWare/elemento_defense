-- Élémento Defense : journal du multijoueur (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- À lancer après admin.sql. Pour savoir ce qui intéresse en multi : duel, coop ou tournoi, à côté ou en ligne,
-- quelles cartes, quels piments, « À zéro » ou « Avec nos progrès ». Rien de personnel.
-- Trois sortes de lignes :
--   'game' : fin d'une partie, une ligne par téléphone (résultat, place, vague, durée, réglages)
--   'room' : salon fermé par l'hôte (durée, joueurs au plus, parties lancées, dernier mode)
--   'view' : écran ouvert (« multi » ou « tour »), une fois par jour et par joueur, même sans jouer
-- Comme game_log : le joueur peut seulement ajouter ses lignes ; si son compte est supprimé, elles deviennent anonymes.

create table if not exists public.mp_log (
  id uuid primary key,                -- créé par le jeu : un envoi répété ne fait pas de doublon
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  player_id text,                     -- identifiant de progression (regroupe les lignes d'un joueur)
  at bigint not null,                 -- moment de l'évènement (ms)
  build int, app text,                -- version du jeu, 'apk' ou 'web'
  kind text not null,                 -- 'game', 'room' ou 'view'
  mode text,                          -- 'duel', 'coop', 'tour' ; pour 'view' : 'multi' ou 'tour'
  net text,                           -- 'online' (en ligne), 'lan' (même Wi-Fi), 'qr' (navigateur, QR code)
  host boolean, players int,          -- hôte ou invité ; nombre de joueurs (au plus, pour un salon)
  map text, diff text, start text,    -- carte ('prairie', 'aleatoire-moyenne', 'mois-2026-10'), difficulté, 'zero' ou 'prog'
  chal jsonb, chal_x numeric,         -- piments choisis (["horde", "sans_feu"…]) et leur multiplicateur
  result text,                        -- 'won', 'lost', 'quit', 'abort' (coupure), 'left' (parti avant la fin)
  place int, wave int, secs int,      -- place au classement (duel), vague atteinte, durée (s) ; salon : durée ouvert
  why text,                           -- duel : cause d'élimination ('ko', 'absent', 'parti', 'abandon')
  extra jsonb,                        -- duel : envois, revenu, vies, tournoi ; coop : vies, tours, PV ; salon : parties, départ
  created_at timestamptz not null default now()
);
create index if not exists mp_log_at on public.mp_log (at);

alter table public.mp_log enable row level security;
drop policy if exists "mp_log: ajouter les siennes" on public.mp_log;
create policy "mp_log: ajouter les siennes" on public.mp_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Pour toi dans le tableau de bord (SQL Editor) : les lignes avec le pseudo du joueur. Invisible depuis le jeu.
drop view if exists public.mp_log_view;
create or replace view public.mp_log_view with (security_invoker = true) as
select g.*, p.v #>> '{}' as pseudo, to_timestamp(g.at / 1000.0) as ended
from public.mp_log g
left join public.player_data p on p.user_id = g.user_id and p.k = 'elemento.pseudo';
revoke all on public.mp_log_view from anon, authenticated;

-- ---------- Requêtes utiles (à coller une par une) ----------
-- Hors toi : ajoute  where coalesce(pseudo, '') not in ('Ygles', 'Test', '')  à chacune.
--
-- 1. Quels modes intéressent : joueurs qui ouvrent l'écran, parties jouées, joueurs qui ont joué
--   select mode, count(distinct player_id) filter (where kind = 'view') ouvrent,
--          count(*) filter (where kind = 'game') parties, count(distinct player_id) filter (where kind = 'game') joueurs
--   from mp_log_view group by mode order by parties desc;
--
-- 2. Comment se finissent les parties (par mode) : victoires, défaites, coupures, départs
--   select mode, result, count(*) from mp_log_view where kind = 'game' group by mode, result order by mode, count(*) desc;
--
-- 3. Cartes, départs et réseau préférés
--   select mode, map, start, net, count(*) parties, round(avg(secs) / 60.0, 1) minutes
--   from mp_log_view where kind = 'game' group by mode, map, start, net order by parties desc;
--
-- 4. Les piments les plus utilisés en multi
--   select p chili, count(*) from mp_log_view, jsonb_array_elements_text(chal) p where kind = 'game' group by p order by count(*) desc;
--
-- 5. Les salons : combien finissent sans aucune partie (personne n'est venu, ou on n'a pas réussi à lancer)
--   select net, count(*) salons, count(*) filter (where (extra->>'games')::int = 0) sans_partie,
--          round(avg(players), 1) joueurs, round(avg(secs) / 60.0, 1) minutes
--   from mp_log_view where kind = 'room' group by net;
