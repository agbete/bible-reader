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

export interface DbTreasureTargetItem {
  reference_code: string;
  book_code: string;
  chapter: number;
  verse_number: number;
  text?: string;
}

export interface DbTreasureItem {
  treasure_id: number;
  title: string;
  description: string;
  target_references: string[];
  target_items?: DbTreasureTargetItem[];
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
    const { data: booksData, error: booksErr } = await supabase
      .from('books')
      .select('id, code, order_index, testament_id, classification_id')
      .order('order_index', { ascending: true });

    if (booksErr || !booksData) {
      console.error('[bibleDb] Erreur chargement livres:', booksErr);
      return [];
    }

    let trQuery = supabase.from('book_translations').select('book_id, language_id, name');
    if (languageId) {
      trQuery = trQuery.eq('language_id', languageId);
    }
    const { data: transData } = await trQuery;

    const { data: testamentsData } = await supabase
      .from('testaments')
      .select('id, code');

    const testamentsMap = new Map<number, string>();
    testamentsData?.forEach(t => testamentsMap.set(t.id, t.code));

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

    return result;
  } catch (err) {
    console.error('[bibleDb] Exception getDbChapterVerses:', err);
    return [];
  }
}

/**
 * 5. Récupère les titres de sections (title_translations) pour une liste de versets
 */
export async function getDbVerseTitles(verseIds: number[], languageId?: number): Promise<Record<number, Record<string, string>>> {
  if (!verseIds || verseIds.length === 0) return {};
  
  try {
    let query = supabase
      .from('title_translations')
      .select('verse_id, language_id, titles')
      .in('verse_id', verseIds);

    if (languageId) {
      query = query.eq('language_id', languageId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[bibleDb] Erreur récupération title_translations:', error.message);
    }

    let finalData = data;
    if (!finalData || finalData.length === 0) {
      const { data: fallbackData } = await supabase
        .from('title_translations')
        .select('verse_id, language_id, titles')
        .in('verse_id', verseIds);
      finalData = fallbackData;
    }

    return formatTitlesMap(finalData || []);
  } catch (err) {
    console.error('[bibleDb] Exception getDbVerseTitles:', err);
    return {};
  }
}

export async function debugTitleTranslations(): Promise<void> {
  // Silent debug helper
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
 * 6. Récupère les références croisées et trésors pour un verset donné avec textes
 */
export async function getDbVerseTreasures(
  referenceCodeOrId: string | number,
  langCode: string = 'fr',
  versionCode: string = 'LSG'
): Promise<DbTreasureItem[]> {
  try {
    // 1. Récupérer l'ID du verset source
    let sourceVerseId: number | null = null;
    let sourceRefCode = '';

    if (typeof referenceCodeOrId === 'number') {
      sourceVerseId = referenceCodeOrId;
    } else {
      const { data: vData } = await supabase
        .from('verses')
        .select('id, reference_code')
        .eq('reference_code', referenceCodeOrId.trim())
        .maybeSingle();
      if (vData) {
        sourceVerseId = vData.id;
        sourceRefCode = vData.reference_code;
      }
    }

    if (!sourceVerseId) return [];

    // 2. Récupérer les trésors pour ce verset source
    const { data: treasures, error: tErr } = await supabase
      .from('treasures')
      .select(`
        id,
        source_verse_id,
        treasure_translations (title, description, language_id),
        treasure_verses (
          id,
          target_verse_id,
          display_order,
          verses:target_verse_id (
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
        )
      `)
      .eq('source_verse_id', sourceVerseId);

    if (tErr || !treasures || treasures.length === 0) {
      // Vérifier les cross_references directes comme fallback
      const { data: crossRefs } = await supabase
        .from('cross_references')
        .select(`
          id,
          target_verse_id,
          verses:target_verse_id (
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
        .eq('source_verse_id', sourceVerseId);

      if (crossRefs && crossRefs.length > 0) {
        const targetVerseIds = crossRefs.map(cr => cr.target_verse_id).filter(Boolean);
        const { data: textsData } = await supabase
          .from('verse_texts')
          .select('verse_id, text, bible_versions!inner(code)')
          .in('verse_id', targetVerseIds)
          .ilike('bible_versions.code', versionCode.trim());

        const textMap = new Map<number, string>();
        textsData?.forEach((t: any) => textMap.set(t.verse_id, t.text));

        const targetItems: DbTreasureTargetItem[] = crossRefs.map((cr: any) => {
          const v = cr.verses;
          const ch = v?.chapters;
          const bk = ch?.books;
          return {
            reference_code: v?.reference_code || '',
            book_code: bk?.code || '',
            chapter: ch?.number || 1,
            verse_number: v?.verse_number || 1,
            text: textMap.get(cr.target_verse_id) || undefined
          };
        });

        return [{
          treasure_id: 0,
          title: 'Références croisées',
          description: '',
          target_references: targetItems.map(ti => ti.reference_code),
          target_items: targetItems
        }];
      }

      return [];
    }

    // Récupérer la version_id
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    const versionId = verData?.id;

    // Collecter tous les verse_ids cibles pour charger leurs textes
    const allTargetVerseIds: number[] = [];
    treasures.forEach(t => {
      t.treasure_verses?.forEach((tv: any) => {
        if (tv.target_verse_id) allTargetVerseIds.push(tv.target_verse_id);
      });
    });

    const targetTextsMap = new Map<number, string>();
    if (allTargetVerseIds.length > 0) {
      let vtQuery = supabase
        .from('verse_texts')
        .select('verse_id, text')
        .in('verse_id', allTargetVerseIds);

      if (versionId) {
        vtQuery = vtQuery.eq('version_id', versionId);
      }

      const { data: texts } = await vtQuery;
      texts?.forEach(t => targetTextsMap.set(t.verse_id, t.text));
    }

    const results: DbTreasureItem[] = treasures.map(t => {
      const trans = t.treasure_translations?.[0];
      const items: DbTreasureTargetItem[] = (t.treasure_verses || []).map((tv: any) => {
        const v = tv.verses;
        const ch = v?.chapters;
        const bk = ch?.books;
        return {
          reference_code: v?.reference_code || '',
          book_code: bk?.code || '',
          chapter: ch?.number || 1,
          verse_number: v?.verse_number || 1,
          text: targetTextsMap.get(tv.target_verse_id) || undefined
        };
      });

      return {
        treasure_id: t.id,
        title: trans?.title || 'Référence croisée',
        description: trans?.description || '',
        target_references: items.map(i => i.reference_code).filter(Boolean),
        target_items: items
      };
    });

    return results;
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

  return {
    connected: isConnected,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
    tables: results,
    versions: versionsList
  };
}

/**
 * 10. Récupère les versions qui ont effectivement des versets dans la base de données
 */
export async function getDbVersionsWithVerses(): Promise<DbBibleVersion[]> {
  try {
    const { data, error } = await supabase.rpc('get_versions_with_verses');
    if (!error && data && data.length > 0) {
      return data;
    }
    return await getDbVersionsWithVersesFallback();
  } catch (err) {
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
    return [];
  }
}