-- Codes Strong grecs (Nouveau Testament) dans la même table que les codes hébreux.
-- Les numéros des deux séries se chevauchent (H1 = ’ab, G1 = ἄλφα) : la colonne « serie »
-- les distingue et la clé devient (serie, code).
-- Appliqué à la base locale le 14/11/2026 ; à appliquer au cloud lors de l'envoi de la base.

begin;

alter table public.strong_codes
  add column serie text not null default 'H'
  constraint strong_codes_serie_check check (serie in ('H', 'G'));
-- Les lignes existantes sont hébreues ; les suivantes doivent préciser leur série
alter table public.strong_codes alter column serie drop default;

alter table public.strong_codes drop constraint strong_codes_pkey;
alter table public.strong_codes add constraint strong_codes_pkey primary key (serie, code);

-- Noms valables pour les deux séries
alter table public.strong_codes rename column mot_hebreu_original to mot_original;
alter table public.strong_codes rename column mot_hebreu_translitere to mot_translitere;

commit;
