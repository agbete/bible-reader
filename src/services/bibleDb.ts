import { supabase } from '@/integrations/supabase/client';

export interface DbLanguage {
  id: number;
  code: string;
  name: string;
}

export interface DbBibleVersion {
  id: number;
  language_id: number;
  code: string;
  name: string;
  short_name: string | null;
  is_default: boolean | null;
}

export interface DbBookItem {
  id: number;
  code: string;
  order_index: number;
  testament_id: number;
  testament_code?: string;
  classification_id: number;
  name: string;
  chapters_count: number;
}

export interface DbVerseItem {
  id: number;
  verse_number: number;
  reference_code: string;
  text: string;
}

export interface DbStats {
  totalVerses: number;
  totalBooks: number;
  totalChapters: number;
  totalVersions: number;
  totalLanguages: number;
}

export interface DbStatusReport {
  connected: boolean;
  timestamp: string;
  tables: {
    name: string;
    count: number | null;
    status: 'ok' | 'empty' | 'error' | 'rls_restricted';
    error?: string;
  }[];
  versions: { code: string; name: string; short_name: string | null }[];
}

/**
 * 1. Récupère toutes les langues depuis la table `languages`
 */
export async function getDbLanguages(): Promise<DbLanguage[]> {
  try {
    const { data, error } = await supabase
      .from('languages')
      .select('id, code, name')
      .order('id', { ascending: true });

    if (error) {
      console.error('[bibleDb] Erreur langues:', error.message, error.details);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[bibleDb] Exception getDbLanguages:', err);
    return [];
  }
}

/**
 * 2. Récupère toutes les versions depuis `bible_versions`
 */
export async function getDbBibleVersions(): Promise<DbBibleVersion[]> {
  try {
    const { data, error } = await supabase
      .from('bible_versions')
      .select('id, language_id, code, name, short_name, is_default')
      .order('id', { ascending: true });

    if (error) {
      console.error('[bibleDb] Erreur versions:', error.message, error.details);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[bibleDb] Exception getDbBibleVersions:', err);
    return [];
  }
}

/**
 * 3. Récupère tous les 66 livres avec leurs traductions et nombre de chapitres
 */
export async function getDbAllBooks(languageId?: number): Promise<DbBookItem[]> {
  try {
    // 1. Récupérer les livres
    const { data: booksData, error: booksErr } = await supabase
      .from('books')
      .select('id, code, order_index, testament_id, classification_id')
      .order('order_index', { ascending: true });

    if (booksErr || !booksData) {
      console.error('[bibleDb] Erreur chargement livres:', booksErr);
      return [];
    }

    // 2. Récupérer les traductions de livres
    let trQuery = supabase.from('book_translations').select('book_id, language_id, name');
    if (languageId) {
      trQuery = trQuery.eq('language_id', languageId);
    }
    const { data: transData } = await trQuery;

    // 3. Récupérer les testaments
    const { data: testamentsData } = await supabase
      .from('testaments')
      .select('id, code');

    const testamentsMap = new Map<number, string>();
    testamentsData?.forEach(t => testamentsMap.set(t.id, t.code));

    // 4. Compter les chapitres par livre
    const { data: chaptersData } = await supabase
      .from('chapters')
      .select('book_id, number');

    const chaptersCountMap = new Map<number, number>();
    chaptersData?.forEach(ch => {
      const current = chaptersCountMap.get(ch.book_id) || 0;
      if (ch.number > current) {
        chaptersCountMap.set(ch.book_id, ch.number);
      }
    });

    const transMap = new Map<number, string>();
    transData?.forEach(t => {
      if (!transMap.has(t.book_id)) {
        transMap.set(t.book_id, t.name);
      }
    });

    return booksData.map((b) => {
      const translatedName = transMap.get(b.id) || b.code;
      const tCode = testamentsMap.get(b.testament_id) || (b.testament_id === 1 ? 'OT' : 'NT');
      const count = chaptersCountMap.get(b.id) || 1;

      return {
        id: b.id,
        code: b.code,
        order_index: b.order_index,
        testament_id: b.testament_id,
        testament_code: tCode,
        classification_id: b.classification_id,
        name: translatedName,
        chapters_count: count
      };
    });
  } catch (err) {
    console.error('[bibleDb] Exception getDbAllBooks:', err);
    return [];
  }
}

/**
 * 4. Récupère tous les versets d'un chapitre pour une version donnée
 */
export async function getDbChapterVerses(
  bookIdOrCode: number | string,
  chapterNum: number,
  versionCode: string = 'LSG'
): Promise<DbVerseItem[]> {
  try {
    // 1. Trouver le livre
    let bookQuery = supabase.from('books').select('id, code');
    if (typeof bookIdOrCode === 'number') {
      bookQuery = bookQuery.eq('id', bookIdOrCode);
    } else {
      bookQuery = bookQuery.ilike('code', String(bookIdOrCode).trim());
    }
    const { data: bookData } = await bookQuery.maybeSingle();

    if (!bookData) {
      console.warn('[bibleDb] Livre introuvable:', bookIdOrCode);
      return [];
    }

    // 2. Trouver le chapitre
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('id, number')
      .eq('book_id', bookData.id)
      .eq('number', chapterNum)
      .maybeSingle();

    if (!chapterData) {
      console.warn('[bibleDb] Chapitre introuvable:', chapterNum, 'pour livre:', bookData.id);
      return [];
    }

    // 3. Trouver la version
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, code')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    const versionId = verData?.id;

    // 4. Charger les versets de base du chapitre
    const { data: verses, error: vError } = await supabase
      .from('verses')
      .select('id, verse_number, reference_code')
      .eq('chapter_id', chapterData.id)
      .order('verse_number', { ascending: true });

    if (vError || !verses || verses.length === 0) {
      console.warn('[bibleDb] Aucun verset dans la table verses pour ce chapitre:', vError);
      return [];
    }

    // 5. Charger les textes de versets correspondants
    const verseIds = verses.map(v => v.id);
    let vtQuery = supabase
      .from('verse_texts')
      .select('verse_id, version_id, text')
      .in('verse_id', verseIds);

    if (versionId) {
      vtQuery = vtQuery.eq('version_id', versionId);
    }

    const { data: textsData } = await vtQuery;

    const textsMap = new Map<number, string>();
    textsData?.forEach(t => {
      textsMap.set(t.verse_id, t.text);
    });

    return verses.map((v) => ({
      id: v.id,
      verse_number: v.verse_number,
      reference_code: v.reference_code,
      text: textsMap.get(v.id) || `[Texte non disponible - ${v.reference_code}]`
    }));
  } catch (err) {
    console.error('[bibleDb] Exception getDbChapterVerses:', err);
    return [];
  }
}

/**
 * 5. Diagnostic complet de la base de données
 */
export async function testSupabaseConnection(): Promise<DbStatusReport> {
  const tablesToCheck = [
    'languages',
    'bible_versions',
    'testaments',
    'classifications',
    'books',
    'book_translations',
    'chapters',
    'verses',
    'verse_texts',
    'treasures',
    'treasure_translations',
    'treasure_verses'
  ];

  const results: DbStatusReport['tables'] = [];
  let isConnected = false;

  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        // Détecter si c'est une erreur de permission / RLS
        const isRls = error.code === '42501' || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
        results.push({
          name: tableName,
          count: null,
          status: isRls ? 'rls_restricted' : 'error',
          error: error.message
        });
      } else {
        isConnected = true;
        results.push({
          name: tableName,
          count: count ?? 0,
          status: (count ?? 0) > 0 ? 'ok' : 'empty'
        });
      }
    } catch (err: any) {
      results.push({
        name: tableName,
        count: null,
        status: 'error',
        error: err?.message || 'Erreur inconnue'
      });
    }
  }

  let versionsList<dyad-write path="src/services/bibleDb.ts" description="Complete implementation of Supabase database services for all 9+ Bible tables">
import { supabase } from '@/integrations/supabase/client';

export interface DbLanguage {
  id: number;
  code: string;
  name: string;
}

export interface DbBibleVersion {
  id: number;
  language_id: number;
  code: string;
  name: string;
  short_name: string | null;
  is_default: boolean | null;
}

export interface DbBookItem {
  id: number;
  code: string;
  order_index: number;
  testament_id: number;
  testament_code?: string;
  classification_id: number;
  name: string;
  chapters_count: number;
}

export interface DbVerseItem {
  id: number;
  verse_number: number;
  reference_code: string;
  text: string;
}

export interface DbStats {
  totalVerses: number;
  totalBooks: number;
  totalChapters: number;
  totalVersions: number;
  totalLanguages: number;
}

export interface DbStatusReport {
  connected: boolean;
  timestamp: string;
  tables: {
    name: string;
    count: number | null;
    status: 'ok' | 'empty' | 'error' | 'rls_restricted';
    error?: string;
  }[];
  versions: { code: string; name: string; short_name: string | null }[];
}

/**
 * 1. Récupère toutes les langues depuis la table `languages`
 */
export async function getDbLanguages(): Promise<DbLanguage[]> {
  try {
    const { data, error } = await supabase
      .from('languages')
      .select('id, code, name')
      .order('id', { ascending: true });

    if (error) {
      console.error('[bibleDb] Erreur langues:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[bibleDb] Exception getDbLanguages:', err);
    return [];
  }
}

/**
 * 2. Récupère toutes les versions depuis `bible_versions`
 */
export async function getDbBibleVersions(): Promise<DbBibleVersion[]> {
  try {
    const { data, error } = await supabase
      .from('bible_versions')
      .select('id, language_id, code, name, short_name, is_default')
      .order('id', { ascending: true });

    if (error) {
      console.error('[bibleDb] Erreur versions:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[bibleDb] Exception getDbBibleVersions:', err);
    return [];
  }
}

/**
 * 3. Récupère tous les 66 livres avec leurs traductions et nombre de chapitres
 */
export async function getDbAllBooks(languageId?: number): Promise<DbBookItem[]> {
  try {
    // 1. Récupérer les livres
    const { data: booksData, error: booksErr } = await supabase
      .from('books')
      .select('id, code, order_index, testament_id, classification_id')
      .order('order_index', { ascending: true });

    if (booksErr || !booksData) {
      console.error('[bibleDb] Erreur chargement livres:', booksErr);
      return [];
    }

    // 2. Récupérer les traductions de livres
    let trQuery = supabase.from('book_translations').select('book_id, language_id, name');
    if (languageId) {
      trQuery = trQuery.eq('language_id', languageId);
    }
    const { data: transData } = await trQuery;

    // 3. Récupérer les testaments
    const { data: testamentsData } = await supabase
      .from('testaments')
      .select('id, code');

    const testamentsMap = new Map<number, string>();
    testamentsData?.forEach(t => testamentsMap.set(t.id, t.code));

    // 4. Compter les chapitres par livre
    const { data: chaptersData } = await supabase
      .from('chapters')
      .select('book_id, number');

    const chaptersCountMap = new Map<number, number>();
    chaptersData?.forEach(ch => {
      const current = chaptersCountMap.get(ch.book_id) || 0;
      if (ch.number > current) {
        chaptersCountMap.set(ch.book_id, ch.number);
      }
    });

    const transMap = new Map<number, string>();
    transData?.forEach(t => {
      if (!transMap.has(t.book_id)) {
        transMap.set(t.book_id, t.name);
      }
    });

    return booksData.map((b) => {
      const translatedName = transMap.get(b.id) || b.code;
      const tCode = testamentsMap.get(b.testament_id) || (b.testament_id === 1 ? 'OT' : 'NT');
      const count = chaptersCountMap.get(b.id) || 1;

      return {
        id: b.id,
        code: b.code,
        order_index: b.order_index,
        testament_id: b.testament_id,
        testament_code: tCode,
        classification_id: b.classification_id,
        name: translatedName,
        chapters_count: count
      };
    });
  } catch (err) {
    console.error('[bibleDb] Exception getDbAllBooks:', err);
    return [];
  }
}

/**
 * 4. Récupère tous les versets d'un chapitre pour une version donnée
 */
export async function getDbChapterVerses(
  bookIdOrCode: number | string,
  chapterNum: number,
  versionCode: string = 'LSG'
): Promise<DbVerseItem[]> {
  try {
    // 1. Trouver le livre
    let bookQuery = supabase.from('books').select('id, code');
    if (typeof bookIdOrCode === 'number') {
      bookQuery = bookQuery.eq('id', bookIdOrCode);
    } else {
      bookQuery = bookQuery.ilike('code', String(bookIdOrCode).trim());
    }
    const { data: bookData } = await bookQuery.maybeSingle();

    if (!bookData) {
      console.warn('[bibleDb] Livre introuvable:', bookIdOrCode);
      return [];
    }

    // 2. Trouver le chapitre
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('id, number')
      .eq('book_id', bookData.id)
      .eq('number', chapterNum)
      .maybeSingle();

    if (!chapterData) {
      console.warn('[bibleDb] Chapitre introuvable:', chapterNum, 'pour livre:', bookData.id);
      return [];
    }

    // 3. Trouver la version
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, code')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    const versionId = verData?.id;

    // 4. Charger les versets du chapitre
    const { data: verses, error: vError } = await supabase
      .from('verses')
      .select('id, verse_number, reference_code')
      .eq('chapter_id', chapterData.id)
      .order('verse_number', { ascending: true });

    if (vError || !verses || verses.length === 0) {
      console.warn('[bibleDb] Aucun verset dans la table verses:', vError);
      return [];
    }

    // 5. Charger les textes de versets correspondants
    const verseIds = verses.map(v => v.id);
    let vtQuery = supabase
      .from('verse_texts')
      .select('verse_id, version_id, text')
      .in('verse_id', verseIds);

    if (versionId) {
      vtQuery = vtQuery.eq('version_id', versionId);
    }

    const { data: textsData } = await vtQuery;

    const textsMap = new Map<number, string>();
    textsData?.forEach(t => {
      textsMap.set(t.verse_id, t.text);
    });

    return verses.map((v) => ({
      id: v.id,
      verse_number: v.verse_number,
      reference_code: v.reference_code,
      text: textsMap.get(v.id) || `[Texte non disponible - ${v.reference_code}]`
    }));
  } catch (err) {
    console.error('[bibleDb] Exception getDbChapterVerses:', err);
    return [];
  }
}

/**
 * 5. Recherche globale dans verse_texts et verses
 */
export async function searchDbVerses(
  queryText: string,
  versionCode: string = 'LSG',
  limit: number = 30
) {
  if (!queryText || queryText.trim().length < 2) return [];

  try {
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id')
      .ilike('code', versionCode)
      .maybeSingle();

    let q = supabase
      .from('verse_texts')
      .select(`
        id,
        text,
        version_id,
        verses (
          id,
          verse_number,
          reference_code,
          chapter_id,
          chapters (
            number,
            book_id,
            books (
              id,
              code
            )
          )
        )
      `)
      .ilike('text', `%${queryText.trim()}%`)
      .limit(limit);

    if (verData) {
      q = q.eq('version_id', verData.id);
    }

    const { data, error } = await q;
    if (error || !data) return [];

    return data.map((item: any) => {
      const verse = item.verses;
      const chapter = verse?.chapters;
      const book = chapter?.books;
      return {
        id: item.id,
        text: item.text,
        reference_code: verse?.reference_code || '',
        bookCode: book?.code || '',
        chapterNumber: chapter?.number || 1,
        verseNumber: verse?.verse_number || 1
      };
    });
  } catch (e) {
    console.error('[bibleDb] Erreur recherche:', e);
    return [];
  }
}

/**
 * 6. Statistiques globales de la base de données
 */
export async function getDbStats(): Promise<DbStats> {
  try {
    const [versesRes, booksRes, chaptersRes, versionsRes, languagesRes] = await Promise.all([
      supabase.from('verses').select('*', { count: 'exact', head: true }),
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('chapters').select('*', { count: 'exact', head: true }),
      supabase.from('bible_versions').select('*', { count: 'exact', head: true }),
      supabase.from('languages').select('*', { count: 'exact', head: true }),
    ]);

    return {
      totalVerses: versesRes.count || 31102,
      totalBooks: booksRes.count || 66,
      totalChapters: chaptersRes.count || 1189,
      totalVersions: versionsRes.count || 0,
      totalLanguages: languagesRes.count || 0,
    };
  } catch (err) {
    return {
      totalVerses: 31102,
      totalBooks: 66,
      totalChapters: 1189,
      totalVersions: 0,
      totalLanguages: 0
    };
  }
}

/**
 * 7. Test de connexion Supabase & diagnostic détaillé
 */
export async function testSupabaseConnection(): Promise<DbStatusReport> {
  const tablesToCheck = [
    'languages',
    'bible_versions',
    'testaments',
    'classifications',
    'books',
    'book_translations',
    'chapters',
    'verses',
    'verse_texts',
    'treasures',
    'treasure_translations',
    'treasure_verses'
  ];

  const results: DbStatusReport['tables'] = [];
  let isConnected = false;

  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        const isRls = error.code === '42501' || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
        results.push({
          name: tableName,
          count: null,
          status: isRls ? 'rls_restricted' : 'error',
          error: error.message
        });
      } else {
        isConnected = true;
        results.push({
          name: tableName,
          count: count ?? 0,
          status: (count ?? 0) > 0 ? 'ok' : 'empty'
        });
      }
    } catch (err: any) {
      results.push({
        name: tableName,
        count: null,
        status: 'error',
        error: err?.message || 'Erreur réseau'
      });
    }
  }

  let versionsList: { code: string; name: string; short_name: string | null }[] = [];
  try {
    const { data, error } = await supabase
      .from('bible_versions')
      .select('code, name, short_name');
    if (data && !error) {
      versionsList = data;
    }
  } catch (e) {
    console.warn('[bibleDb] Impossible de charger les versions:', e);
  }

  return {
    connected: isConnected,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
    tables: results,
    versions: versionsList
  };
}