import type { StrongWordLink } from '@/services/strongDb';

export interface StrongMark {
  /** Début du mot dans le texte */
  start: number;
  /** Position dans le texte, juste après le mot */
  end: number;
  codes: number[];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Même longueur que l'original : les positions trouvées valent pour le texte affiché */
const normalizeText = (s: string) => s.replace(/[’‘]/g, "'").replace(/[  ]/g, ' ');

/**
 * Place chaque code Strong juste après son mot dans le texte du verset.
 * Les mots sont cherchés dans l'ordre, à partir du mot précédent : un mot présent deux fois
 * reçoit ainsi le bon code. Un mot introuvable est ignoré sans faire avancer la recherche.
 */
export function computeStrongMarks(text: string, words: StrongWordLink[]): StrongMark[] {
  const haystack = normalizeText(text);
  const marks = new Map<number, { start: number; codes: number[] }>();
  let cursor = 0;

  for (const { word, code } of words) {
    // Ponctuation, espaces et symboles autour du mot retirés (« commencement, », « terre. »)
    const needle = normalizeText(word).trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!needle) continue;
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(needle).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`,
      'giu'
    );
    pattern.lastIndex = cursor;
    const match = pattern.exec(haystack);
    if (!match) continue;
    cursor = match.index + match[0].length;
    if (code !== null) {
      const mark = marks.get(cursor) ?? { start: match.index, codes: [] };
      if (!mark.codes.includes(code)) mark.codes.push(code);
      marks.set(cursor, mark);
    }
  }

  return Array.from(marks, ([end, { start, codes }]) => ({ start, end, codes })).sort((a, b) => a.end - b.end);
}
