import { supabase } from '@/integrations/supabase/client';
import { DbBibleVersion, DbBookItem, DbLanguage, getDbAllBooks, getDbLanguages, getDbVersionsWithVerses } from '@/services/bibleDb';
import { Dictionary, getDictionaries, getDictionaryEntryCounts } from '@/services/dictionaryDb';
import { getLsgVerseTexts, STRONG_MAX_CODES } from '@/services/strongDb';

// ─── Données de la page d'accueil, lues dans la base ───

/** Jour de l'année (1-366) : le verset et le code du jour changent chaque jour, identiques pour tous */
export function dayOfYear(date = new Date()): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
}

const countRows = async (table: string): Promise<number | null> => {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? null : count;
};

export interface HomeStats {
  verses: number | null;
  chapters: number | null;
  books: number | null;
  strongCodes: number | null;
  dictionaryEntries: number | null;
}

/** Totaux de la base (chaque compteur à null s'il n'a pas pu être lu) */
export async function getHomeStats(dictionaries: Dictionary[]): Promise<HomeStats> {
  const [verses, chapters, books, strongCodes, entryCounts] = await Promise.all([
    countRows('verses'),
    countRows('chapters'),
    countRows('books'),
    countRows('strong_codes'),
    getDictionaryEntryCounts(dictionaries.map(d => d.id)).catch(() => null),
  ]);
  const dictionaryEntries = entryCounts ? [...entryCounts.values()].reduce((sum, n) => sum + n, 0) : null;
  return { verses, chapters, books, strongCodes, dictionaryEntries };
}

export interface HomeLibrary {
  languages: DbLanguage[];
  /** Langue française (noms des livres, testaments, classements) */
  frenchLanguageId: number | null;
  versions: DbBibleVersion[];
  books: DbBookItem[];
  testaments: { id: number; name: string }[];
  classifications: { id: number; name: string; testament_id: number }[];
  dictionaries: Dictionary[];
}

/** Livres classés (testaments → classements), versions qui ont des versets, langues et dictionnaires */
export async function getHomeLibrary(): Promise<HomeLibrary> {
  const languages = await getDbLanguages();
  const french = languages.find(l => l.code?.toLowerCase().startsWith('fr')) ?? null;
  const frenchLanguageId = french?.id ?? null;
  const [versions, books, testamentsRes, classificationsRes, testamentNames, classificationNames, dictionaries] = await Promise.all([
    getDbVersionsWithVerses(),
    getDbAllBooks(frenchLanguageId ?? undefined),
    supabase.from('testaments').select('id, code, order_index').order('order_index', { ascending: true }),
    supabase.from('classifications').select('id, code, testament_id, order_index').order('order_index', { ascending: true }),
    frenchLanguageId !== null
      ? supabase.from('testament_translations').select('testament_id, name').eq('language_id', frenchLanguageId)
      : Promise.resolve({ data: [] as { testament_id: number; name: string }[] }),
    frenchLanguageId !== null
      ? supabase.from('classification_translations').select('classification_id, name').eq('language_id', frenchLanguageId)
      : Promise.resolve({ data: [] as { classification_id: number; name: string }[] }),
    getDictionaries(),
  ]);
  const testamentName = new Map((testamentNames.data || []).map(t => [t.testament_id, t.name]));
  const classificationName = new Map((classificationNames.data || []).map(c => [c.classification_id, c.name]));
  return {
    languages,
    frenchLanguageId,
    versions,
    books,
    testaments: (testamentsRes.data || []).map(t => ({
      id: t.id,
      name: testamentName.get(t.id) || (t.code === 'OT' ? 'Ancien Testament' : 'Nouveau Testament'),
    })),
    classifications: (classificationsRes.data || []).map(c => ({
      id: c.id,
      name: classificationName.get(c.id) || c.code,
      testament_id: c.testament_id,
    })),
    dictionaries: dictionaries.filter(d => d.is_active !== false),
  };
}

/** Versets proposés comme verset du jour (codes verses.reference_code) */
const DAILY_REFERENCES = [
  'JEA.3.16', 'PSA.23.1', 'PRO.3.5', 'ESA.41.10', 'PHI.4.13', 'ROM.8.28', 'JER.29.11', 'MAT.11.28',
  'PSA.119.105', 'JOS.1.9', 'ESA.40.31', 'ROM.12.2', 'MAT.6.33', 'PSA.46.2', '2TI.3.16', 'HEB.11.1',
  'JEA.14.6', 'GAL.5.22', 'PSA.27.1', 'LAM.3.22', 'ROM.5.8', 'EPH.2.8', '1CO.13.4', 'JEA.1.1',
  'PSA.37.5', 'MAT.5.9', 'PSA.91.1', 'JAC.1.5', '1JE.4.8', 'ESA.53.5', 'GEN.1.1', 'MIC.6.8',
  'PSA.121.1', 'JEA.8.32', 'ROM.10.9', 'COL.3.23', 'PHI.4.6', '1PE.5.7', 'DEU.31.6', 'APO.21.4',
];

export interface DailyVerse {
  referenceCode: string;
  bookCode: string;
  chapter: number;
  verse: number;
  text: string;
}

/** Verset du jour en Louis Segond (le suivant de la liste si un verset manque dans la base) */
export async function getDailyVerse(date = new Date()): Promise<DailyVerse | null> {
  const texts = await getLsgVerseTexts(DAILY_REFERENCES);
  const start = dayOfYear(date) % DAILY_REFERENCES.length;
  for (let i = 0; i < DAILY_REFERENCES.length; i++) {
    const ref = DAILY_REFERENCES[(start + i) % DAILY_REFERENCES.length];
    const text = texts.get(ref);
    if (!text) continue;
    const [bookCode, chapter, verse] = ref.split('.');
    return { referenceCode: ref, bookCode, chapter: Number(chapter), verse: Number(verse), text };
  }
  return null;
}

/** Code Strong hébreu du jour (parcourt tous les codes H, un nouveau chaque jour) */
export function dailyStrongCode(date = new Date()): number {
  return ((dayOfYear(date) + date.getFullYear() * 366) * 97) % STRONG_MAX_CODES.H + 1;
}

/** Dernière lecture sur la page Bible (enregistrée par la page Lecture) */
export interface LastReading {
  referenceCode: string;
  bookName: string;
  chapter: number;
}

export const LAST_READING_KEY = 'reader-last-reading';

export function readLastReading(): LastReading | null {
  try {
    const raw = localStorage.getItem(LAST_READING_KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value.referenceCode === 'string' ? value as LastReading : null;
  } catch {
    return null;
  }
}

export function saveLastReading(reading: LastReading): void {
  try { localStorage.setItem(LAST_READING_KEY, JSON.stringify(reading)); } catch { /* stockage indisponible */ }
}
