-- Élémento Defense : remontée d'erreurs (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- Les erreurs du jeu (version, écran, message technique), sans rien de personnel. Le joueur peut seulement en ajouter :
-- il ne peut ni les relire ni les effacer. Compte supprimé : ses erreurs restent, anonymes.

create table if not exists public.client_errors (
  id uuid primary key,                 -- créé par le jeu : un envoi répété ne fait pas de doublon
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  build int, app text,                 -- version du jeu, 'apk' ou 'web'
  screen text,                         -- écran au moment de l'erreur (title, game, multi…)
  msg text, src text, line int,        -- message, fichier et ligne
  stack text,
  n int not null default 1,            -- nombre de fois sur la session
  at bigint,                           -- première fois (ms)
  created_at timestamptz not null default now()
);
create index if not exists client_errors_build on public.client_errors (build, created_at);
alter table public.client_errors enable row level security;
drop policy if exists "client_errors: ajouter les siennes" on public.client_errors;
create policy "client_errors: ajouter les siennes" on public.client_errors
  for insert to authenticated with check ((select auth.uid()) = user_id
    and char_length(coalesce(msg, '')) <= 500 and char_length(coalesce(stack, '')) <= 2000 and char_length(coalesce(src, '')) <= 200 and char_length(coalesce(screen, '')) <= 20);

-- Pour toi (SQL Editor) : les erreurs les plus fréquentes de la dernière version
--   select build, msg, src, line, count(*) joueurs, sum(n) fois, max(created_at) derniere
--   from client_errors group by build, msg, src, line order by build desc, joueurs desc;
