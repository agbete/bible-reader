// Analyse des références bibliques écrites dans les titres de niveau 5.
// Chaque référence produit le premier verset qu'elle cite :
//   « (Matthieu 12:22-30; Marc 3:22-27) » → MAT.12.22, MAR.3.22
//   « (Matthieu 5:15; 6:22-23) »          → MAT.5.15, MAT.6.22   (livre implicite)
//   « (Matthieu 5:15,19-22) »             → MAT.5.15, MAT.5.19   (chapitre implicite)
//   « (Matthieu 5:15-17, 20-25) »         → MAT.5.15, MAT.5.20
//   « (Psaumes 105:1-15; 96; 106:1,47) »  → PSA.105.1, PSA.96.1, PSA.106.1, PSA.106.47

export interface BookNameEntry {
  code: string;
  name: string;
}

export interface ParsedReference {
  bookCode: string;
  chapter: number;
  verse: number;
  /** Aucun verset écrit (« Psaumes 96 ») : verset 1 par défaut, ou verset du chapitre unique (« Jude 5 ») */
  chapterOnly: boolean;
  /** Format du champ verses.reference_code, ex. "LUC.11.2" */
  referenceCode: string;
  /** Position du texte de la référence dans le titre, pour en faire un lien */
  start: number;
  end: number;
}

/** Minuscules, sans accents, sans espaces ni ponctuation : « 1 Chroniques » → "1chroniques" */
const normalizeBookName = (str: string) =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export type BookNameIndex = { key: string; code: string }[];

/** Index des noms de livres (toutes langues) et des codes eux-mêmes */
export const buildBookNameIndex = (entries: BookNameEntry[]): BookNameIndex => {
  const seen = new Set<string>();
  const index: BookNameIndex = [];
  entries.forEach(({ code, name }) => {
    [code, name].forEach(value => {
      const key = normalizeBookName(value);
      if (key && !seen.has(`${key}|${code}`)) {
        seen.add(`${key}|${code}`);
        index.push({ key, code });
      }
    });
  });
  return index;
};

/** Nom complet ou abréviation (« Deut ») → code du livre, seulement si un seul livre correspond */
const resolveBookCode = (rawName: string, index: BookNameIndex): string | null => {
  const key = normalizeBookName(rawName);
  if (!key) return null;
  const exact = new Set(index.filter(e => e.key === key).map(e => e.code));
  if (exact.size === 1) return [...exact][0];
  const byPrefix = new Set(index.filter(e => e.key.startsWith(key)).map(e => e.code));
  if (byPrefix.size === 1) return [...byPrefix][0];
  return null;
};

// Une référence : [livre] nombre [:verset] [- fin], ex. « 1 Chroniques 1:5-23 », « 6:22-23 », « 19-22 », « 96 »
// Le livre commence par une lettre, éventuellement précédée d'un chiffre (« 1 Tan ») ;
// un demi-verset (« 20b ») est accepté ; la fin d'intervalle (« -23:3 ») est ignorée.
const PART_PATTERN = /^(?:((?:[1-3]\s*)?\p{L}[^\d]*?)\s*)?(\d+)(?:\s*[:.]\s*(\d+)[a-z]?)?(?:\s*[-–—]\s*\d+[a-z]?(?:\s*[:.]\s*\d+[a-z]?)?)?\s*$/iu;

/** Toutes les références d'un titre, dans l'ordre */
export const parseReferences = (title: string, index: BookNameIndex): ParsedReference[] => {
  const results: ParsedReference[] = [];
  let bookCode: string | null = null;
  let chapter: number | null = null;
  // true quand la référence précédente donnait un verset : un nombre seul après « , » est alors un verset
  let inVerseList = false;

  const tokenPattern = /[^;,]+/g;
  let token: RegExpExecArray | null;
  while ((token = tokenPattern.exec(title)) !== null) {
    const separator = token.index > 0 ? title[token.index - 1] : '';
    if (separator === ';') inVerseList = false;

    // Bornes du texte utile (sans espaces ni parenthèses autour)
    const raw = token[0];
    const leading = raw.match(/^[\s()]*/)![0].length;
    const trailing = raw.match(/[\s()]*$/)![0].length;
    const text = raw.slice(leading, raw.length - trailing);
    if (!text) continue;
    const start = token.index + leading;
    const end = start + text.length;

    const match = text.match(PART_PATTERN);
    if (!match) {
      // Texte non reconnu : on ne rattache pas les nombres suivants à un mauvais livre
      bookCode = null;
      inVerseList = false;
      continue;
    }
    const [, bookName, firstNumber, verseNumber] = match;

    if (bookName) {
      bookCode = resolveBookCode(bookName, index);
      inVerseList = false;
    }
    if (!bookCode) continue;

    let verse: number;
    let chapterOnly = false;
    if (verseNumber) {
      chapter = Number(firstNumber);
      verse = Number(verseNumber);
      inVerseList = true;
    } else if (inVerseList && separator === ',' && chapter !== null) {
      verse = Number(firstNumber);
    } else {
      chapter = Number(firstNumber);
      verse = 1;
      chapterOnly = true;
      inVerseList = false;
    }

    results.push({
      bookCode,
      chapter: chapter!,
      verse,
      chapterOnly,
      referenceCode: `${bookCode}.${chapter}.${verse}`,
      start,
      end
    });
  }
  return results;
};
