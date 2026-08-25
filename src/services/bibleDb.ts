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

export interface DbTreasureItem {
  treasure_id: number;
  title: string;
  description: string;
  target_references: string[];
  target_texts?: string[];
}

export interface DbSearchResult {
  id: number;
  verse_id: number;
  reference_code: string;
  bookCode: string;
  chapterNumber: number;
  verseNumber: number;
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
    console.log('[bibleDb] Fetching languages...');
    const { data, error } = await supabase
      .from('languages')
      .select('id, code, name')
      .order('id', { ascending: true });

    if (error) {
      console.error('[bibleDb] Erreur langues:', error.message, error.details, error.hint);
      // Try with schema specification
      const { data: data2, error: error2 } = await supabase
        .from('public.languages')
        .select('id, code, name')
        .order('id', { ascending: true });
      if (!error2 && data2) {
        console.log('[bibleDb] Languages loaded with schema:', data2.length);
        return data2;
      }
      return [];
    }
    console.log('[bibleDb] Languages loaded:', data?.length || 0);
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
    console.log('[bibleDb] Fetching bible versions...');
    const { data, error } = await supabase
      .from('bible_versions')
      .select('id, language_id, code, name, short_name, is_default')
      .order('id', { ascending: true });

    if (error) {
      console.error('[bibleDb] Erreur versions:', error.message, error.details, error.hint);
      // Try with schema specification
      const { data: data2, error: error2 } = await supabase
        .from('public.bible_versions')
        .select('id, language_id, code, name, short_name, is_default')
        .order('id', { ascending: true });
      if (!error2 && data2) {
        console.log('[bibleDb] Versions loaded with schema:', data2.length);
        return data2;
      }
      return [];
    }
    console.log('[bibleDb] Versions loaded:', data?.length || 0);
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
    console.log('[bibleDb] Fetching all books...', { languageId });
    
    const { data: booksData, error: booksErr } = await supabase
      .from('books')
      .select('id, code, order_index, testament_id, classification_id')
      .order('order_index', { ascending: true });

    if (booksErr || !booksData) {
      console.error('[bibleDb] Erreur chargement livres:', booksErr);
      return [];
    }

    console.log('[bibleDb] Raw books data:', booksData.length);

    // Récupérer les traductions des noms de livres
    let trQuery = supabase.from('book_translations').select('book_id, language_id, name');
    if (languageId) {
      trQuery = trQuery.eq('language_id', languageId);
    }
    const { data: transData } = await trQuery;

    // Récupérer les codes des testaments
    const { data: testamentsData } = await supabase
      .from('testaments')
      .select('id, code');

    const testamentsMap = new Map<number, string>();
    testamentsData?.forEach(t => testamentsMap.set(t.id, t.code));

    // Récupérer le nombre de chapitres par livre
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

    // Mapper les traductions
    const transMap = new Map<number, string>();
    transData?.forEach(t => {
      if (!transMap.has(t.book_id)) {
        transMap.set(t.book_id, t.name);
      }
    });

    const result = booksData.map((b) => {
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

    console.log('[bibleDb] Books processed:', result.length);
    return result;
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
    console.log('[bibleDb] Fetching chapter verses:', { bookIdOrCode, chapterNum, versionCode });
    
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

    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, code')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    const versionId = verData?.id;

    const { data: verses, error: vError } = await supabase
      .from('verses')
      .select('id, verse_number, reference_code')
      .eq('chapter_id', chapterData.id)
      .order('verse_number', { ascending: true });

    if (vError || !verses || verses.length === 0) {
      console.warn('[bibleDb] Aucun verset trouvé pour ce chapitre');
      return [];
    }

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

    const result = verses.map((v) => ({
      id: v.id,
      verse_number: v.verse_number,
      reference_code: v.reference_code,
      text: textsMap.get(v.id) || `[Texte non disponible - ${v.reference_code}]`
    }));

    console.log('[bibleDb] Verses loaded:', result.length);
    return result;
  } catch (err) {
    console.error('[bibleDb] Exception getDbChapterVerses:', err);
    return [];
  }
}

/**
 * 5. Récupère les références croisées et trésors pour un verset
 */
export async function getDbVerseTreasures(referenceCode: string, langCode: string = 'fr', versionCode: string = 'LSG'): Promise<DbTreasureItem[]> {
  try {
    console.log('[bibleDb] Fetching treasures for:', referenceCode);
    
    const { data, error } = await supabase.rpc('get_verse_treasures', {
      p_reference_code: referenceCode,
      p_language_code: langCode,
      p_version_code: versionCode
    });

    if (!error && data && data.length > 0) {
      console.log('[bibleDb] Treasures via RPC:', data.length);
      return data;
    }

    // Fallback: requête directe
    const { data: verseData } = await supabase
      .from('verses')
      .select('id')
      .eq('reference_code', referenceCode)
      .maybeSingle();

    if (!verseData) return [];

    const { data: treasures } = await supabase
      .from('treasures')
      .select(`
        id,
        treasure_translations (title, description),
        treasure_verses (
          target_verse_id,
          verses:target_verse_id (reference_code)
        )
      `)
      .eq('source_verse_id', verseData.id);

    if (!treasures) return [];

    const result = treasures.map((t: any) => ({
      treasure_id: t.id,
      title: t.treasure_translations?.[0]?.title || 'Référence croisée',
      description: t.treasure_translations?.[0]?.description || '',
      target_references: t.treasure_verses?.map((tv: any) => tv.verses?.reference_code).filter(Boolean) || []
    }));

    console.log('[bibleDb] Treasures via direct query:', result.length);
    return result;
  } catch (err) {
    console.error('[bibleDb] Erreur getDbVerseTreasures:', err);
    return [];
  }
}

/**
 * 6. Recherche textuelle dans toute la Bible
 */
export async function searchDbVerses(searchTerm: string, versionCode: string = 'LSG', limit: number = 15): Promise<DbSearchResult[]> {
  try {
    console.log('[bibleDb] Searching verses:', { searchTerm, versionCode, limit });
    
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    let query = supabase
      .from('verse_texts')
      .select(`
        id,
        verse_id,
        text,
        verses:verse_id (
          id,
          verse_number,
          reference_code,
          chapter_id,
          chapters:chapter_id (
            number,
            book_id,
            books:book_id (code)
          )
        )
      `)
      .ilike('text', `%${searchTerm}%`)
      .limit(limit);

    if (verData?.id) {
      query = query.eq('version_id', verData.id);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error('[bibleDb] Search error:', error);
      return [];
    }

    const result = data.map((item: any) => {
      const v = item.verses;
      const ch = v?.chapters;
      const bk = ch?.books;
      return {
        id: item.id,
        verse_id: item.verse_id,
        reference_code: v?.reference_code || '',
        bookCode: bk?.code || 'GEN',
        chapterNumber: ch?.number || 1,
        verseNumber: v?.verse_number || 1,
        text: item.text
      };
    });

    console.log('[bibleDb] Search results:', result.length);
    return result;
  } catch (err) {
    console.error('[bibleDb] Exception searchDbVerses:', err);
    return [];
  }
}

/**
 * 7. Statistiques globales de la base de données
 */
export async function getDbStats(): Promise<DbStats> {
  try {
    console.log('[bibleDb] Fetching stats...');
    const [versesRes, booksRes, chaptersRes, versionsRes, languagesRes] = await Promise.all([
      supabase.from('verses').select('*', { count: 'exact', head: true }),
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('chapters').select('*', { count: 'exact', head: true }),
      supabase.from('bible_versions').select('*', { count: 'exact', head: true }),
      supabase.from('languages').select('*', { count: 'exact', head: true }),
    ]);

    const stats = {
      totalVerses: versesRes.count || 31102,
      totalBooks: booksRes.count || 66,
      totalChapters: chaptersRes.count || 1189,
      totalVersions: versionsRes.count || 0,
      totalLanguages: languagesRes.count || 0,
    };
    
    console.log('[bibleDb] Stats:', stats);
    return stats;
  } catch (err) {
    console.error('[bibleDb] Exception getDbStats:', err);
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
 * 8. Test de connexion Supabase & diagnostic détaillé
 */
export async function testSupabaseConnection(): Promise<DbStatusReport> {
  console.log('[bibleDb] Testing Supabase connection...');
  
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

  const report = {
    connected: isConnected,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
    tables: results,
    versions: versionsList
  };
  
  console.log('[bibleDb] Connection test result:', report);
  return report;
}

/**
 * 9. Récupère les versions qui ont effectivement des versets dans la base de données
 */
export async function getDbVersionsWithVerses(): Promise<DbBibleVersion[]> {
  try {
    console.log('[bibleDb] Fetching versions with verses...');
    
    // Récupérer les IDs des versions qui ont au moins un verset dans verse_texts
    const { data, error } = await supabase
      .from('verse_texts')
      .select(`
        version_id,
        bible_versions!inner (id, code, name, short_name, language_id, is_default)
      `)
      .order('version_id', { ascending: true });

    if (error) {
      console.error('[bibleDb] Erreur versions avec versets:', error);
      return [];
    }

    // Déduplication par version_id
    const uniqueVersions = new Map<number, DbBibleVersion>();
    data?.forEach((item: any) => {
      const version = item.bible_versions;
      if (version && !uniqueVersions.has(version.id)) {
        uniqueVersions.set(version.id, {
          id: version.id,
          code: version.code,
          name: version.name,
          short_name: version.short_name,
          language_id: version.language_id,
          is_default: version.is_default
        });
      }
    });

    console.log('[bibleDb] Versions with verses:', uniqueVersions.size);
    return Array.from(uniqueVersions.values());
  } catch (err) {
    console.error('[bibleDb] Exception getDbVersionsWithVerses:', err);
    return [];
  }
}