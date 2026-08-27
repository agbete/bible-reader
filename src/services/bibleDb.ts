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
  book_name?: string;
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

export interface DbCrossReferenceItem {
  id: number;
  target_verse_id: number;
  reference_code: string;
  book_code: string;
  book_name?: string;
  chapter: number;
  verse_number: number;
  text?: string;
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

    const { data: testamentsData } = await supabase.from('testaments').select('id, code');

    const testamentsMap = new Map<number, string>();
    testamentsData?.forEach(t => testamentsMap.set(t.id, t.code));

    const { data: chaptersData } = await supabase.from('chapters').select('book_id, number');
    const chaptersCountMap = new Map<number, number>();
    chaptersData?.forEach(ch => {
      const current = chaptersCountMap.get(ch.book_id) || 0;
      if (ch.number > current) chaptersCountMap.set(ch.book_id, ch.number);
    });

    const transMap = new Map<number, string>();
    transData?.forEach(t => { if (!transMap.has(t.book_id)) transMap.set(t.book_id, t.name); });

    const result = booksData.map((b) => ({
      id: b.id,
      code: b.code,
      order_index: b.order_index,
      testament_id: b.testament_id,
      testament_code: testamentsMap.get(b.testament_id) || (b.testament_id === 1 ? 'OT' : 'NT'),
      classification_id: b.classification_id,
      name: transMap.get(b.id) || b.code,
      chapters_count: chaptersCountMap.get(b.id) || 1
    }));

    return result;
  } catch (err) {
    console.error('[bibleDb] Exception getDbAllBooks:', err);
    return [];
  }
}

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
      .select('id, language_id')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    const versionId = verData?.id;
    const languageId = verData?.language_id;

    const { data: verses, error: vError } = await supabase
      .from('verses')
      .select('id, verse_number, reference_code')
      .eq('chapter_id', chapterData.id)
      .order('verse_number', { ascending: true });

    if (vError || !verses || verses.length === 0) return [];

    const verseIds = verses.map(v => v.id);
    let vtQuery = supabase
      .from('verse_texts')
      .select('verse_id, version_id, text')
      .in('verse_id', verseIds);

    if (versionId) vtQuery = vtQuery.eq('version_id', versionId);

    const { data: textsData } = await vtQuery;
    const textsMap = new Map<number, string>();
    textsData?.forEach(t => textsMap.set(t.verse_id, t.text));

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

export async function getDbVerseTitles(verseIds: number[], languageId?: number): Promise<Record<number, Record<string, string>>> {
  if (!verseIds || verseIds.length === 0) return {};
  try {
    let query = supabase
      .from('title_translations')
      .select('verse_id, language_id, titles')
      .in('verse_id', verseIds);

    if (languageId) query = query.eq('language_id', languageId);

    const { data, error } = await query;
    if (error) console.error('[bibleDb] Erreur title_translations:', error.message);

    let finalData = data;
    if (!finalData || finalData.length === 0) {
      const { data: fb } = await supabase.from('title_translations').select('verse_id, language_id, titles').in('verse_id', verseIds);
      finalData = fb;
    }

    return formatTitlesMap(finalData || []);
  } catch (err) {
    console.error('[bibleDb] Exception getDbVerseTitles:', err);
    return {};
  }
}

export async function debugTitleTranslations(): Promise<void> {}

function formatTitlesMap(data: any[]): Record<number, Record<string, string>> {
  const map: Record<number, Record<string, string>> = {};
  data.forEach((row) => {
    let parsed: Record<string, string> = {};
    if (typeof row.titles === 'string') {
      try { parsed = JSON.parse(row.titles); } catch (e) {}
    } else if (typeof row.titles === 'object' && row.titles !== null) {
      parsed = row.titles;
    }
    if (!map[row.verse_id] || Object.keys(map[row.verse_id]).length === 0) {
      map[row.verse_id] = parsed;
    }
  });
  return map;
}

export async function getDbVerseCrossReferences(
  referenceCodeOrId: string | number,
  versionCode: string = 'LSG',
  languageId?: number
): Promise<DbCrossReferenceItem[]> {
  console.log('[bibleDb] getDbVerseCrossReferences called with:', {
    referenceCodeOrId,
    versionCode,
    languageId,
    timestamp: new Date().toISOString(),
  });
  try {
    let sourceVerseId: number | null = null;

    if (typeof referenceCodeOrId === 'number') {
      sourceVerseId = referenceCodeOrId;
    } else {
      const { data: vData } = await supabase
        .from('verses')
        .select('id')
        .eq('reference_code', referenceCodeOrId.trim())
        .maybeSingle();
      if (vData) sourceVerseId = vData.id;
    }

    if (!sourceVerseId) {
      console.warn('[bibleDb] Source verse not found for cross refs:', referenceCodeOrId);
      return [];
    }

    const { data: crossRefs, error } = await supabase
      .from('cross_references')
      .select(`
        id,
        target_verse_id,
        verses:target_verse_id (
          id, verse_number, reference_code, chapter_id,
          chapters:chapter_id ( number, book_id,
            books:book_id ( id, code,
              book_translations (name, language_id)
            )
          )
        )
      `)
      .eq('source_verse_id', sourceVerseId);

    if (error || !crossRefs || crossRefs.length === 0) {
      console.log('[bibleDb] No cross references found, returning empty array');
      return [];
    }

    const targetVerseIds = crossRefs.map(cr => cr.target_verse_id).filter(Boolean);

    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, language_id')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    const versionId = verData?.id;
    const targetLangId = languageId || verData?.language_id;

    console.log('[bibleDb] Cross refs - versionId:', versionId, 'targetLangId:', targetLangId, 'crossRefCount:', crossRefs.length);

    let vtQuery = supabase.from('verse_texts').select('verse_id, text').in('verse_id', targetVerseIds);
    if (versionId) vtQuery = vtQuery.eq('version_id', versionId);
    const { data: textsData } = await vtQuery;

    const textMap = new Map<number, string>();
    textsData?.forEach((t: any) => textMap.set(t.verse_id, t.text));

    return crossRefs.map((cr: any) => {
      const v = cr.verses;
      const ch = v?.chapters;
      const bk = ch?.books;
      const trans = bk?.book_translations?.find((bt: any) => targetLangId ? bt.language_id === targetLangId : true);
      const bookName = trans?.name || bk?.code || '';

      return {
        id: cr.id,
        target_verse_id: cr.target_verse_id,
        reference_code: v?.reference_code || '',
        book_code: bk?.code || '',
        book_name: bookName,
        chapter: ch?.number || 1,
        verse_number: v?.verse_number || 1,
        text: textMap.get(cr.target_verse_id) || undefined
      };
    });
  } catch (err) {
    console.error('[bibleDb] Erreur getDbVerseCrossReferences:', err);
    return [];
  }
}

export async function getDbVerseTreasures(
  referenceCodeOrId: string | number,
  langCode: string = 'fr',
  versionCode: string = 'LSG',
  languageId?: number
): Promise<DbTreasureItem[]> {
  console.log('[bibleDb] getDbVerseTreasures called with:', {
    referenceCodeOrId,
    langCode,
    versionCode,
    languageId,
    timestamp: new Date().toISOString(),
  });
  try {
    let sourceVerseId: number | null = null;

    if (typeof referenceCodeOrId === 'number') {
      sourceVerseId = referenceCodeOrId;
    } else {
      const { data: vData } = await supabase
        .from('verses')
        .select('id, reference_code')
        .eq('reference_code', referenceCodeOrId.trim())
        .maybeSingle();
      if (vData) sourceVerseId = vData.id;
    }

    if (!sourceVerseId) {
      console.warn('[bibleDb] Source verse not found for treasures:', referenceCodeOrId);
      return [];
    }

    // Get version info to find the correct languageId for treasure translations
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, language_id')
      .ilike('code', versionCode.trim())
      .maybeSingle();

    const versionId = verData?.id;
    
    // ✅ FIX: Always use French (language_id = 2) for treasure translations
    // The treasures table has French translations, not the version's language
    const TREASURES_FRENCH_LANG_ID = 2;
    const targetLangId = TREASURES_FRENCH_LANG_ID;

    console.log('[bibleDb] Treasures - versionCode:', versionCode, 'versionId:', versionId, 'targetLangId:', targetLangId, 'langCode:', langCode);

    const { data: treasures, error: tErr } = await supabase
      .from('treasures')
      .select(`
        id, source_verse_id,
        treasure_translations (title, description, language_id),
        treasure_verses (
          id, target_verse_id, display_order,
          verses:target_verse_id (
            id, verse_number, reference_code, chapter_id,
            chapters:chapter_id ( number, book_id,
              books:book_id ( id, code,
                book_translations (name, language_id)
              )
            )
          )
        )
      `)
      .eq('source_verse_id', sourceVerseId);

    if (tErr || !treasures || treasures.length === 0) {
      console.log('[bibleDb] No treasures found for verse:', sourceVerseId);
      return [];
    }

    const allTargetVerseIds: number[] = [];
    treasures.forEach(t => {
      t.treasure_verses?.forEach((tv: any) => {
        if (tv.target_verse_id) allTargetVerseIds.push(tv.target_verse_id);
      });
    });

    const targetTextsMap = new Map<number, string>();
    if (allTargetVerseIds.length > 0) {
      let vtQuery = supabase.from('verse_texts').select('verse_id, text').in('verse_id', allTargetVerseIds);
      if (versionId) vtQuery = vtQuery.eq('version_id', versionId);
      const { data: texts } = await vtQuery;
      texts?.forEach(t => targetTextsMap.set(t.verse_id, t.text));
    }

    console.log('[bibleDb] Found', treasures.length, 'treasures, targetLangId for translations:', targetLangId);

    return treasures.map(t => {
      // Find translation matching French (language_id = 2)
      let trans = t.treasure_translations?.find(
        (tr: any) => tr.language_id === targetLangId
      );
      if (!trans && t.treasure_translations && t.treasure_translations.length > 0) {
        // Fallback: try by langCode
        console.log('[bibleDb] No French translation found for languageId', targetLangId, ', available:', t.treasure_translations.map((tr: any) => ({ langId: tr.language_id, title: tr.title })));
        trans = t.treasure_translations[0];
      }

      console.log('[bibleDb] Treasure', t.id, '- selected translation:', trans?.title, 'languageId:', trans?.language_id);

      const items: DbTreasureTargetItem[] = (t.treasure_verses || []).map((tv: any) => {
        const v = tv.verses;
        const ch = v?.chapters;
        const bk = ch?.books;
        const bTrans = bk?.book_translations?.find((bt: any) => targetLangId ? bt.language_id === targetLangId : true);
        const bookName = bTrans?.name || bk?.code || '';

        return {
          reference_code: v?.reference_code || '',
          book_code: bk?.code || '',
          book_name: bookName,
          chapter: ch?.number || 1,
          verse_number: v?.verse_number || 1,
          text: targetTextsMap.get(tv.target_verse_id) || undefined
        };
      });

      return {
        treasure_id: t.id,
        title: trans?.title || 'Trésor biblique',
        description: trans?.description || '',
        target_references: items.map(i => i.reference_code).filter(Boolean),
        target_items: items
      };
    });
  } catch (err) {
    console.error('[bibleDb] Erreur getDbVerseTreasures:', err);
    return [];
  }
}

export async function searchDbVerses(searchTerm: string, versionCode: string = 'LSG', limit: number = 15): Promise<DbSearchResult[]> {
  try {
    const { data: verData } = await supabase.from('bible_versions').select('id').ilike('code', versionCode.trim()).maybeSingle();

    let query = supabase
      .from('verse_texts')
      .select(`id, verse_id, text, verses:verse_id ( id, verse_number, reference_code, chapter_id, chapters:chapter_id ( number, book_id, books:book_id (code) ) )`)
      .ilike('text', `%${searchTerm}%`)
      .limit(limit);

    if (verData?.id) query = query.eq('version_id', verData.id);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((item: any) => {
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
  } catch (err) {
    console.error('[bibleDb] Exception searchDbVerses:', err);
    return [];
  }
}

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
    return { totalVerses: 31102, totalBooks: 66, totalChapters: 1189, totalVersions: 0, totalLanguages: 0 };
  }
}

export async function testSupabaseConnection(): Promise<DbStatusReport> {
  const tablesToCheck = [
    'languages','bible_versions','testaments','classifications','books',
    'book_translations','chapters','verses','verse_texts',
    'title_translations','cross_references','treasures','treasure_translations','treasure_verses'
  ];

  const results: DbStatusReport['tables'] = [];
  let isConnected = false;

  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (error) {
        const isRls = error.code === '42501' || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy');
        results.push({ name: tableName, count: null, status: isRls ? 'rls_restricted' : 'error', error: error.message });
      } else {
        isConnected = true;
        results.push({ name: tableName, count: count ?? 0, status: (count ?? 0) > 0 ? 'ok' : 'empty' });
      }
    } catch (err: any) {
      results.push({ name: tableName, count: null, status: 'error', error: err?.message || 'Erreur réseau' });
    }
  }

  let versionsList: { code: string; name: string; short_name: string | null }[] = [];
  try {
    const { data } = await supabase.from('bible_versions').select('code, name, short_name');
    if (data && !data) versionsList = data;
  } catch (e) {}

  return { connected: isConnected, timestamp: new Date().toLocaleTimeString('fr-FR'), tables: results, versions: versionsList };
}

export async function getDbVersionsWithVerses(): Promise<DbBibleVersion[]> {
  try {
    const { data, error } = await supabase.rpc('get_versions_with_verses');
    if (!error && data && data.length > 0) return data;
    return await getDbVersionsWithVersesFallback();
  } catch (err) {
    return await getDbVersionsWithVersesFallback();
  }
}

async function getDbVersionsWithVersesFallback(): Promise<DbBibleVersion[]> {
  try {
    const { data: vtData, error } = await supabase.from('verse_texts').select('version_id');
    if (error || !vtData || vtData.length === 0) return [];
    const versionIds = [...new Set(vtData.map(item => item.version_id))];
    if (versionIds.length === 0) return [];
    const { data, error: vErr } = await supabase.from('bible_versions').select('id, language_id, code, name, short_name, is_default').in('id', versionIds).order('id', { ascending: true });
    if (vErr) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}