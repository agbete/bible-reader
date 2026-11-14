// Titres de section : tailles en "em", donc relatives à la taille de lecture choisie.
// Écarts définis pour un texte de 16px (+2px = 18/16 = 1.125em, -4px = 12/16 = 0.75em),
// ils grandissent ou rétrécissent proportionnellement avec le texte des versets.
export const TITLE_LEVEL_STYLES: Record<number, { fontSize: string; className: string }> = {
  1: { fontSize: '1.125em', className: 'font-bold uppercase text-amber-900 dark:text-amber-200' },
  2: { fontSize: '0.75em', className: 'italic text-foreground' },
  3: { fontSize: '1.125em', className: 'font-bold text-amber-900 dark:text-amber-200' },
  4: { fontSize: '1em', className: 'font-bold text-foreground' },
  5: { fontSize: '0.75em', className: 'italic text-muted-foreground' }
};
