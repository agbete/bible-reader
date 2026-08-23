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
  testament_code?: string; // 'OT' | 'NT'
  classification_id: number;
  name: string; // translated name or fallback code
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

/**
 * 1. Récupère toutes les langues depuis la table `languages`
 */
export async function getDbLanguages(): Promise<DbLanguage[]> {
  try {
    const { data, error } = await supabase
      .from('languages')
      .select('id, code, name')
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn('[bibleDb] Erreur chargement langues:', error);
      return [];
    }
    return data;
  } catch (err) {
    console.error('[bibleDb] Exception langues:', err);
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

    if (error || !data || data.length === 0) {
      console.warn('[bibleDb] Erreur chargement versions:', error);
      return [];
    }
    return data;
  } catch (err) {
    console.error('[bibleDb] Exception versions:', err);
    return [];
  }
}

/**
 * 3. Récupère tous les 66 livres avec leur nom traduit et le nombre réel de chapitres
 */
export async function getDbAllBooks(languageId?: number): Promise<DbBookItem[]> {
  try {
    // 1. Récupérer les livres avec testaments et traductions
    const { data: booksData, error: bError } = await supabase
      .from('books')
      .select(`
        id,
        code,
        order_index,
        testament_id,
        classification_id,
        testaments (
          id,
          code
        ),
        book_translations (
          book_id,
          language_id,
          name
        )
      `)
      .order('order_index', { ascending: true });

    if (bError || !booksData) {
      console.error('[bibleDb] Erreur chargement livres:', bError);
      return [];
    }

    // 2. Récupérer les chapitres pour connaître le compte exact par livre
    const { data: chaptersData } = await supabase
      .from('chapters')
      .select('book_id, number');

    const chaptersMap = new Map<number, number>();
    if (chaptersData) {
      chaptersData.forEach((ch) => {
        const currentMax = chaptersMap.get(ch.book_id) || 0;
        if (ch.number > currentMax) {
          chaptersMap.set(ch.book_id, ch.number);
        }
      });
    }

    return booksData.map((b: any) => {
      // Trouver la traduction du nom pour la langue choisie ou la première disponible
      const translations: any[] = b.book_translations || [];
      const matchTr = languageId 
        ? translations.find(t => t.language_id === languageId) 
        : translations[0];
      const translatedName = matchTr?.name || b.code;

      const testamentCode = b.testaments?.code || (b.testament_id === 1 ? 'OT' : 'NT');
      const count = chaptersMap.get(b.id) || 1;

      return {
        id: b.id,
        code: b.code,
        order_index: b.order_index,
        testament_id: b.testament_id,
        testament_code: testamentCode,
        classification_id: b.classification_id,
        name: translatedName,
        chapters_count: count
      };
    });
  } catch (err) {
    console.error('[bibleDb] Exception livres:', err);
    return [];
  }
}

/**
 * 4. Récupère tous les versets d'un chapitre pour une version donnée depuis `verses` et `verse_texts`
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
      bookQuery = bookQuery.ilike('code', bookIdOrCode);
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
      console.warn('[bibleDb] Chapitre introuvable:', chapterNum);
      return [];
    }

    // 3. Trouver la version
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, code')
      .ilike('code', versionCode)
      .maybeSingle();

    const versionId = verData?.id;

    // 4. Charger les versets du chapitre avec le texte de la version
    const { data: verses, error: vError } = await supabase
      .from('verses')
      .select(`
        id,
        verse_number,
        reference_code,
        verse_texts (
          id,
          version_id,
          text
        )
      `)
      .eq('chapter_id', chapterData.id)
      .order('verse_number', { ascending: true });

    if (vError || !verses) {
      console.error('[bibleDb] Erreur chargement versets:', vError);
      return [];
    }

    return verses.map((v: any) => {
      const texts: any[] = v.verse_texts || [];
      const match = versionId 
        ? texts.find((t) => t.version_id === versionId) 
        : texts[0];

      return {
        id: v.id,
        num: v.verse_number,
        verse_number: v.verse_number,
        reference_code: v.reference_code,
        text: match?.text || `[Texte non disponible pour cette version - ${v.reference_code}]`
      };
    });
  } catch (err) {
    console.error('[bibleDb] Exception versets:', err);
    return [];
  }
}

/**
 * 5. Recherche globale dans `verse_texts` et `verses`
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
 * 7. Test de connexion Supabase & diagnostic
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
    'verse_texts'
  ];

  const results: DbStatusReport['tables'] = [];
  let isConnected = false;

  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results.push({
          name: tableName,
          count: null,
          status: 'error',
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