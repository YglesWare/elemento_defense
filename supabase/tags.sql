-- Élémento Defense : champs par joueur (à coller dans SQL Editor → New query → Run ; se relance sans risque)
-- Un champ et sa valeur par adresse e-mail (compte Google), pour des clins d'œil à quelques testeurs
-- (ex. champ 'blague' = 'SRE', js/surprise.js). Les adresses restent dans la base, jamais dans le code (le dépôt est public).
-- Elles valent même avant la première connexion.
--
-- Ajouter un champ (à faire à la main, ici dans le SQL Editor) :
--   insert into public.user_tags (email, field, value) values ('adresse@exemple.com', 'blague', 'SRE')
--     on conflict (email, field) do update set value = excluded.value;

create table if not exists public.user_tags (
  email text not null,
  field text not null,
  value text,
  added_at timestamptz not null default now(),
  primary key (email, field)
);
alter table public.user_tags enable row level security;  -- aucune règle : personne ne lit la table, seulement la fonction

-- Mes champs (ceux de l'e-mail du compte connecté), rien de plus : { "blague": "SRE" }
create or replace function public.my_tags() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(field, value), '{}'::jsonb) from user_tags where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
revoke all on function public.my_tags() from public, anon;
grant execute on function public.my_tags() to authenticated;
