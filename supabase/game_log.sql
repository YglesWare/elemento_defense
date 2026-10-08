-- Élémento Defense : journal des parties (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- Une ligne par partie solo terminée, pour analyser et améliorer le jeu (comparer les vraies parties au bot d'équilibrage).
-- Rien de personnel : la carte, la difficulté, le résultat, les éclats.
-- Le joueur peut seulement ajouter ses parties : il ne peut ni les relire ni les effacer. Le journal n'est jamais effacé :
-- si un compte est supprimé, ses parties restent mais deviennent anonymes (user_id passe à null).

create table if not exists public.game_log (
  id uuid primary key,                -- créé par le jeu : un envoi répété ne fait pas de doublon
  user_id uuid default auth.uid() references auth.users (id) on delete set null,  -- null = compte supprimé (anonyme)
  player_id text,                     -- identifiant de progression tiré au hasard par le jeu (regroupe les parties d'un joueur)
  at bigint not null,                 -- fin de la partie (ms)
  build int, app text,                -- version du jeu, 'apk' ou 'web'
  map text, map_n int, diff text,     -- ex. 'prairie', 1, 'facile' ; cartes aléatoires : 'aleatoire-petite', 'jour-20261003'
  result text not null,               -- 'won', 'ko' ou 'quit'
  wave int, waves int, lives int,     -- vague atteinte / nombre de vagues / vies restantes
  game_n int,                         -- numéro de la partie pour ce joueur
  secs int,                           -- durée de jeu (s)
  shards int, shards_left int, earned int, atelier int,  -- éclats gagnés, en poche, gagnés en tout, paliers d'Atelier achetés
  towers jsonb,                       -- tours en place à la fin, ex. {"feu": 3, "terre": 2}
  hard boolean,
  created_at timestamptz not null default now()
);
-- Si une version précédente de ce script a déjà été lancée : suppression du compte → anonymisation (et non plus effacement)
alter table public.game_log alter column user_id drop not null;
alter table public.game_log drop constraint if exists game_log_user_id_fkey;
alter table public.game_log add constraint game_log_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
create index if not exists game_log_player on public.game_log (player_id, at);

-- Version 102 : ce que le joueur a fait pendant la partie, son expérience et l'emplacement de ses tours
-- (pour distinguer un débutant perdu, qui pose ses tours loin du chemin, d'un vrai mur de difficulté)
alter table public.game_log add column if not exists placed int;       -- tours posées pendant la partie
alter table public.game_log add column if not exists sold int;         -- tours vendues
alter table public.game_log add column if not exists ups int;          -- achats d'amélioration (Dégâts, Portée…)
alter table public.game_log add column if not exists first_leak int;   -- vague du premier slime entré dans la maison
alter table public.game_log add column if not exists revives int;      -- secondes chances utilisées (Atelier ou pub)
alter table public.game_log add column if not exists ad_offer boolean; -- seconde chance par pub proposée
alter table public.game_log add column if not exists max_speed int;    -- vitesse maximale utilisée (1 à 3)
alter table public.game_log add column if not exists xp jsonb;         -- expérience : parties, victoires, minutes de jeu, cartes réussies, tutoriel, histoire
alter table public.game_log add column if not exists layout jsonb;     -- tours en fin de partie : [{t, q, r, d (distance au chemin), rg (portée), n (achats)}]

-- Sécurité : ajout de ses propres parties seulement (ni lecture, ni modification, ni suppression depuis le jeu)
alter table public.game_log enable row level security;
drop policy if exists "game_log: lire les siennes" on public.game_log;
drop policy if exists "game_log: effacer les siennes" on public.game_log;
drop policy if exists "game_log: ajouter les siennes" on public.game_log;
create policy "game_log: ajouter les siennes" on public.game_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Pour toi dans le tableau de bord (SQL Editor) : les parties avec le pseudo du joueur.
-- Invisible depuis le jeu : la vue n'est pas ouverte aux comptes joueurs.
-- Recréée à chaque fois : elle reprend les colonnes ajoutées au journal
drop view if exists public.game_log_view;
create or replace view public.game_log_view with (security_invoker = true) as
select g.*, p.v #>> '{}' as pseudo, to_timestamp(g.at / 1000.0) as ended
from public.game_log g
left join public.player_data p on p.user_id = g.user_id and p.k = 'elemento.pseudo';
revoke all on public.game_log_view from anon, authenticated;
