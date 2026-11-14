import type { StrongWordLink } from '@/services/strongDb';

export interface StrongMark {
  /** Début du mot dans le texte (= end pour un mot hébreu non traduit sans mot avant lui) */
  start: number;
  /** Position dans le texte, juste après le mot */
  end: number;
  /** Codes des mots hébreux traduits par ce mot */
  codes: number[];
  /** Codes des mots hébreux non traduits (« ◎ » dans la source), placés à cet endroit du texte */
  untranslated: number[];
}

/** Symbole de la source pour un mot hébreu qui n'a pas de mot français correspondant */
export const UNTRANSLATED_MARKER = '◎';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Lettre sans accent, un caractère pour un caractère (« À » → « A », « é » → « e ») */
const baseLetter = (ch: string) => (ch.length === 1 && ch > '\u007f' ? ch.normalize('NFD')[0] : ch);
/**
 * Même longueur que l'original : les positions trouvées valent pour le texte affiché.
 * Sans accents : la source écrit « À », « Ève », la Segond « A », « Eve ».
 */
const normalizeText = (s: string) => Array.from(s.replace(/[’‘]/g, "'").replace(/[  ]/g, ' '), baseLetter).join('');
/** Motif d'une lettre : « œ » trouve aussi « oe » (« cœur » / « coeur ») */
const letterPattern = (ch: string) => (/œ/i.test(ch) ? '(?:œ|oe)' : /æ/i.test(ch) ? '(?:æ|ae)' : escapeRegExp(ch));
/**
 * Motif d'un mot : trait d'union = espace (« Très-Haut » / « Très Haut »), et un trait d'union
 * peut séparer deux lettres du texte sans figurer dans la source (KJV : « Bethel » / « Beth-el »).
 */
const wordPattern = (needle: string) => needle
  .split(/[\s-]+/)
  .map(part => Array.from(part, letterPattern).join('-?'))
  .join('[\\s\\-]+');

/**
 * Place chaque code Strong juste après son mot dans le texte du verset.
 * Les mots sont cherchés dans l'ordre, à partir du mot précédent : un mot présent deux fois
 * reçoit ainsi le bon code. Un mot introuvable est ignoré sans faire avancer la recherche.
 */
export function computeStrongMarks(text: string, words: StrongWordLink[]): StrongMark[] {
  const haystack = normalizeText(text);
  const marks = new Map<number, Omit<StrongMark, 'end'>>();
  let cursor = 0;

  const addCodes = (end: number, start: number, codes: number[], untranslated: boolean) => {
    const mark = marks.get(end) ?? { start, codes: [], untranslated: [] };
    const list = untranslated ? mark.untranslated : mark.codes;
    codes.forEach(code => { if (!list.includes(code)) list.push(code); });
    marks.set(end, mark);
  };

  for (const { word, codes } of words) {
    // Ponctuation, espaces et symboles autour du mot retirés (« commencement, », « terre. »)
    let raw = normalizeText(word).trim();
    const untranslated = raw.includes(UNTRANSLATED_MARKER);
    if (untranslated) raw = raw.split(UNTRANSLATED_MARKER).join('').trim();
    const needle = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

    if (!needle) {
      if (codes.length === 0) continue;
      // Signe seul (« , » H5921 en Ézéchiel 16:14, « ◎, ») : code juste après le signe,
      // à condition que le signe suive directement le mot précédent
      const index = raw ? haystack.indexOf(raw, cursor) : -1;
      if (index !== -1 && haystack.slice(cursor, index).trim() === '') {
        cursor = index + raw.length;
        addCodes(cursor, index, codes, untranslated);
      } else if (untranslated) {
        // « ◎ » : mot hébreu non traduit, à sa place entre le mot précédent et le suivant
        addCodes(cursor, cursor, codes, true);
      }
      continue;
    }

    const find = (search: string) => {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${wordPattern(search)}(?![\\p{L}\\p{N}])`,
        'giu'
      );
      pattern.lastIndex = cursor;
      const found = pattern.exec(haystack);
      if (found) return found;
      // Pas après le mot précédent : celui-ci a pu être pris trop loin (verset découpé autrement que dans
      // la source, Genèse 42:34). On cherche alors dans tout le verset, à une place pas encore prise.
      pattern.lastIndex = 0;
      for (let m = pattern.exec(haystack); m; m = pattern.exec(haystack)) {
        if (!marks.has(m.index + m[0].length)) return m;
      }
      return null;
    };
    // Locution (« jusqu'à ce que ») écrite autrement dans le texte : le code va sur son dernier mot
    const match = find(needle) ?? (/\s/.test(needle) ? find(needle.split(/\s+/).pop()!) : null);
    if (!match) continue;
    cursor = match.index + match[0].length;
    // Tous les codes du mot, dans l'ordre (« Égyptiens » 1121 4714)
    if (codes.length > 0) addCodes(cursor, match.index, codes, untranslated);
    // Ponctuation collée au mot dans la source (« sortiras, ») : la suite se place après elle
    // (« tu sortiras, ◎ » → code non traduit après la virgule)
    const trailing = (raw.match(/[^\p{L}\p{N}]+$/u)?.[0] ?? '').replace(/\s+/g, '');
    let k = cursor;
    for (const ch of trailing) {
      while (haystack[k] === ' ') k++;
      if (haystack[k] !== ch) break;
      cursor = ++k;
    }
  }

  return Array.from(marks, ([end, mark]) => ({ ...mark, end })).sort((a, b) => a.end - b.end);
}
