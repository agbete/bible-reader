-- Informations des pages source des dictionnaires (levangile.com), à côté de la définition :
--   site_id               numéro du mot sur le site (distingue les homonymes)
--   url                   page d'origine
--   autres_dictionnaires  liens vers le même mot dans les autres dictionnaires : [{dictionnaire, url}]
--   atlas                 lieux de la carte « Atlas biblique » : [{titre, adresse (HTML), lat, lng}]
--   numerisation          mention « Numérisation : … »
-- Appliqué à la base locale le 15/11/2026 ; à appliquer au cloud lors de l'envoi de la base.

begin;

alter table public.dictionary_entries
  add column if not exists site_id integer,
  add column if not exists url text,
  add column if not exists autres_dictionnaires jsonb,
  add column if not exists atlas jsonb,
  add column if not exists numerisation text;

create unique index if not exists dictionary_entries_dict_site_id_key
  on public.dictionary_entries (dictionary_id, site_id);

commit;
