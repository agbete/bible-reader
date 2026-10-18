-- Libellé de renvoi affiché à la place d'un verset sans texte : « Voir Luc 3:1 », « See Luke 3:1 »…
-- Un libellé par langue, modifiable directement dans la table.

ALTER TABLE public.languages
  ADD COLUMN IF NOT EXISTS see_label text;

COMMENT ON COLUMN public.languages.see_label IS
  'Libellé du lien de renvoi vers le dernier verset non vide (ex. Voir, See, Kpɔ́n, Wo)';

UPDATE public.languages
SET see_label = CASE code
  WHEN 'fr' THEN 'Voir'
  WHEN 'en' THEN 'See'
  WHEN 'fn' THEN 'Kpɔ́n'
  WHEN 'gu' THEN 'Kpɔ́n'  -- Gun / Goun
  WHEN 'go' THEN 'Kpɔ́n'  -- ancien code du Gun
  WHEN 'yo' THEN 'Wo'
  WHEN 'hb' THEN 'Voir'  -- Hébreu
  WHEN 'gr' THEN 'Voir'  -- Grec
END
WHERE see_label IS NULL;
