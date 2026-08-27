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
      console.error('[bibleDb] Erreur langues:', error.message);
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
      console.error('[bibleDb] Erreur versions:', error.message);
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
 * 5. Récupère les titres de sections (title_translations) pour une liste de versets
 * CORRECTION: Utilise le code de langue (ex: 'fr', 'en') au lieu de l'ID pour un mapping fiable
 */
export async function getDbVerseTitles(verseIds: number[], languageCode?: string): Promise<Record<number, Record<string, string>>> {
  if (!verseIds || verseIds.length === 0) return {};
  
  try {
    console.log('[bibleDb] Fetching titles for verseIds:', verseIds.length, 'languageCode:', languageCode);
    
    // Si on a un code de langue, on récupère l'ID correspondant
    let targetLanguageId: number | undefined;
    if (languageCode) {
      const { data: langData } = await supabase
        .from('languages')
        .select('id')
        .eq('code', languageCode)
        .maybeSingle();
      targetLanguageId = langData?.id;
      console.log('[bibleDb] Mapped languageCode', languageCode, 'to languageId:', targetLanguageId);
    }
    
    // Essayer d'abord avec le language_id mappé
    let query = supabase
      .from('title_translations')
      .select('verse_id, language_id, titles')
      .in('verse_id', verseIds);

    if (targetLanguageId) {
      query = query.eq('language_id', targetLanguageId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[bibleDb] Erreur récupération title_translations:', error.message, error.details);
    }

    // Si pas de résultats avec le language_id spécifique, essayer sans filtre de langue
    // (les titres peuvent être stockés sous un language_id différent)
    let finalData = data;
    if (!finalData || finalData.length === 0) {
      console.log('[bibleDb] Aucun titre avec language_id, tentative sans filtre de langue...');
      const { data: fallbackData } = await supabase
        .from('title_translations')
        .select('verse_id, language_id, titles')
        .in('verse_id', verseIds);
      finalData = fallbackData;
    }

    // Si toujours rien, essayer avec les language_id courants (fr=2, en=1, etc.)
    if (!finalData || finalData.length === 0) {
      console.log('[bibleDb] Tentative avec language_id courants (1, 2, 3)...');
      const { data: commonLangData } = await supabase
        .from('title_translations')
        .select('verse_id, language_id, titles')
        .in('verse_id', verseIds)
        .in('language_id', [1, 2, 3, 4, 5]);
      finalData = commonLangData;
    }

    console.log('[bibleDb] Title rows received (final):', finalData?.length || 0);
    return formatTitlesMap(finalData || []);
  } catch (err) {
    console.error('[bibleDb] Exception getDbVerseTitles:', err);
    return {};
  }
}

/**
 * 5b. DIAGNOSTIC : Vérifier la structure et le contenu de title_translations
 */
export async function debugTitleTranslations(): Promise<void> {
  console.group('🔍 [bibleDb] DIAGNOSTIC title_translations');
  
  try {
    // 1. Compter les lignes totales
    const { count, error: countError } = await supabase
      .from('title_translations')
      .select('*', { count: 'exact', head: true });
    
    console.log('Total rows in title_translations:', count);
    if (countError) {
      console.error('Count error:', countError);
    }

    // 2. Récupérer les 5 premières lignes
    const { data: sampleData, error: sampleError } = await supabase
      .from('title_translations')
      .select('*')
      .limit(5);
    
    console.log('Sample data (first 5 rows):', sampleData);
    if (sampleError) {
      console.error('Sample error:', sampleError);
    }

    // 3. Vérifier les langues disponibles
    const { data: langData, error: langError } = await supabase
      .from('title_translations')
      .select('language_id')
      .limit(20);
    
    if (!langError && langData) {
      const langIds = [...new Set(langData.map(l => l.language_id))];
      console.log('Language IDs found in title_translations:', langIds);
      
      // Récupérer les codes de langue correspondants
      if (langIds.length > 0) {
        const { data: langCodes } = await supabase
          .from('languages')
          .select('id, code, name')
          .in('id', langIds);
        console.log('Language codes for those IDs:', langCodes);
      }
    }

    // 4. Vérifier les versets disponibles
    const { data: verseData, error: verseError } = await supabase
      .from('title_translations')
      .select('verse_id')
      .limit(20);
    
    if (!verseError && verseData) {
      const verseIds = [...new Set(verseData.map(v => v.verse_id))];
      console.log('Verse IDs found in title_translations (first 20):', verseIds);
    }

    // 5. Test direct avec les IDs 1-5
    const { data: testIdsData, error: testIdsError } = await supabase
      .from('title_translations')
      .select('*')
      .in('verse_id', [1, 2, 3, 4, 5]);
    
    console.log('Test with verse IDs 1-5:', testIdsData);
    if (testIdsError) {
      console.error('Test IDs error:', testIdsError);
    }

    // 6. Vérifier les politiques RLS
    const { data: rlsData, error: rlsError } = await supabase
      .from('title_translations')
      .select('*')
      .limit(1);
    
    console.log('RLS test (unfiltered):', rlsData);
    if (rlsError) {
      console.error('RLS error:', rlsError);
    }

  } catch (err) {
    console.error('Diagnostic error:', err);
  }
  
  console.groupEnd();
}

function formatTitlesMap(data: any[]): Record<number, Record<string, string>> {
  const map: Record<number, Record<string, string>> = {};
  data.forEach((row) => {
    let parsed: Record<string, string> = {};
    if (typeof row.titles === 'string') {
      try {
        parsed = JSON.parse(row.titles);
      } catch (e) {
        console.warn('[bibleDb] Failed parsing titles string:', row.titles);
      }
    } else if (typeof row.titles === 'object' && row.titles !== null) {
      parsed = row.titles;
    }
    
    if (!map[row.verse_id] || Object.keys(map[row.verse_id]).length === 0) {
      map[row.verse_id] = parsed;
    }
  });
  return map;
}

/**
 * 6. Récupère les références croisées et trésors pour un verset
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
 * 7. Recherche textuelle dans toute la Bible
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
 * 8. Statistiques globales de la base de données
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
 * 9. Test de connexion Supabase & diagnostic détaillé
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
    'title_translations',
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
 * 10. Récupère les versions qui ont effectivement des versets dans la base de données
 */
export async function getDbVersionsWithVerses(): Promise<DbBibleVersion[]> {
  try {
    console.log('[bibleDb] Fetching versions with verses via RPC...');
    
    const { data, error } = await supabase.rpc('get_versions_with_verses');
    
    if (error) {
      console.error('[bibleDb] Erreur RPC get_versions_with_verses:', error);
      return await getDbVersionsWithVersesFallback();
    }
    
    console.log('[bibleDb] Versions with verses:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[bibleDb] Exception getDbVersionsWithVerses:', err);
    return await getDbVersionsWithVersesFallback();
  }
}

async function getDbVersionsWithVersesFallback(): Promise<DbBibleVersion[]> {
  try {
    const { data: verseTextsData, error: vtError } = await supabase
      .from('verse_texts')
      .select('version_id');

    if (vtError || !verseTextsData || verseTextsData.length === 0) {
      return [];
    }

    const versionIds = [...new Set(verseTextsData.map(item => item.version_id))];
    if (versionIds.length === 0) return [];

    const { data: versionsData, error: vError } = await supabase
      .from('bible_versions')
      .select('id, language_id, code, name, short_name, is_default')
      .in('id', versionIds)
      .order('id', { ascending: true });

    if (vError) return [];
    return versionsData || [];
  } catch (err) {
    console.error('[bibleDb] Fallback exception getDbVersionsWithVersesFallback:', err);
    return [];
  }
}