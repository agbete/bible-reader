import { supabase } from '@/integrations/supabase/client';
import { DbVerseItem, DbBookItem, DbSearchResult, DbLanguage, DbBibleVersion, DbStats, DbStatusReport } from '@/types/bibleDb';

/**
 * Test the Supabase connection and gather stats about tables
 */
export async function testSupabaseConnection(): Promise<DbStatusReport> {
  const timestamp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  const tablesToCheck = [
    'languages',
    'testaments',
    'testament_translations',
    'classifications',
    'classification_translations',
    'books',
    'book_translations',
    'chapters',
    'verses',
    'verse_texts',
    'bible_versions',
    'title_translations',
    'treasures',
    'treasure_verses',
    'treasure_translations',
    'cross_references'
  ];

  const report: DbStatusReport = {
    connected: false,
    timestamp,
    tables: [],
    versions: []
  };

  try {
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('languages')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('[bibleDb] Connection test failed:', testError);
      report.connected = false;
      report.tables = tablesToCheck.map(name => ({
        name,
        count: null,
        status: 'error' as const,
        error: testError.message
      }));
      return report;
    }

    report.connected = true;

    // Check each table
    for (const tableName of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
            report.tables.push({
              name: tableName,
              count: null,
              status: 'rls_restricted',
              error: error.message
            });
          } else {
            report.tables.push({
              name: tableName,
              count: null,
              status: 'error',
              error: error.message
            });
          }
        } else {
          report.tables.push({
            name: tableName,
            count: count || 0,
            status: (count || 0) > 0 ? 'ok' : 'empty'
          });
        }
      } catch (err: any) {
        report.tables.push({
          name: tableName,
          count: null,
          status: 'error',
          error: err?.message || 'Unknown error'
        });
      }
    }

    // Get bible versions info
    try {
      const { data: versionsData } = await supabase
        .from('bible_versions')
        .select('id, code, name, short_name, is_default')
        .order('id');

      if (versionsData) {
        report.versions = versionsData.map(v => ({
          id: v.id,
          code: v.code,
          name: v.name,
          short_name: v.short_name || v.code,
          is_default: v.is_default || false
        }));
      }
    } catch (err) {
      console.warn('[bibleDb] Could not load versions:', err);
    }

    return report;
  } catch (err: any) {
    console.error('[bibleDb] Exception in testSupabaseConnection:', err);
    return {
      ...report,
      connected: false,
      tables: tablesToCheck.map(name => ({
        name,
        count: null,
        status: 'error' as const,
        error: err?.message || 'Connection failed'
      }))
    };
  }
}

/**
 * Format titles map from title_translations rows
 */
function formatTitlesMap(rows: any[]): Record<number, Record<string, string>> {
  const map: Record<number, Record<string, string>> = {};
  
  rows.forEach(row => {
    if (!row.verse_id || !row.titles) return;
    
    if (!map[row.verse_id]) {
      map[row.verse_id] = {};
    }
    
    // Merge titles from same verse (different language_id entries)
    Object.entries(row.titles).forEach(([level, text]) => {
      if (text && String(text).trim()) {
        map[row.verse_id][level] = String(text);
      }
    });
  });
  
  return map;
}

/**
 * 5. Récupère les titres de sections (title_translations) pour une liste de versets
 * CORRECTION: Utilise directement language_id au lieu de mapper par code
 */
export async function getDbVerseTitles(verseIds: number[], languageId?: number): Promise<Record<number, Record<string, string>>> {
  if (!verseIds || verseIds.length === 0) return {};
  
  try {
    console.log('[bibleDb] Fetching titles for verseIds:', verseIds.length, 'languageId:', languageId);
    
    let query = supabase
      .from('title_translations')
      .select('verse_id, language_id, titles')
      .in('verse_id', verseIds);

    if (languageId !== undefined) {
      query = query.eq('language_id', languageId);
    } else {
      const { data: noFilterData } = await query;
      if (noFilterData && noFilterData.length > 0) {
        console.log('[bibleDb] Titles without language filter:', noFilterData.length);
        return formatTitlesMap(noFilterData);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[bibleDb] Erreur récupération title_translations:', error.message);
    }

    let finalData = data;
    if (!finalData || finalData.length === 0) {
      console.log('[bibleDb] Aucun titre avec language_id, tentative sans filtre...');
      const { data: fallbackData } = await supabase
        .from('title_translations')
        .select('verse_id, language_id, titles')
        .in('verse_id', verseIds);
      finalData = fallbackData;
    }

    if (!finalData || finalData.length === 0) {
      console.log('[bibleDb] Tentative avec language_id courants...');
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
 * Debug function for title translations
 */
export async function debugTitleTranslations(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('title_translations')
      .select('verse_id, language_id, titles')
      .limit(5);
    
    if (error) {
      console.error('[bibleDb] debugTitleTranslations error:', error);
    } else {
      console.log('[bibleDb] Sample title_translations:', data);
    }
  } catch (err) {
    console.error('[bibleDb] debugTitleTranslations exception:', err);
  }
}

/**
 * Get all languages
 */
export async function getDbLanguages(): Promise<DbLanguage[]> {
  try {
    const { data, error } = await supabase
      .from('languages')
      .select('id, code, name')
      .order('id');
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[bibleDb] getDbLanguages error:', err);
    return [];
  }
}

/**
 * Get all bible versions that have verses
 */
export async function getDbVersionsWithVerses(): Promise<DbBibleVersion[]> {
  try {
    const { data, error } = await supabase
      .from('bible_versions')
      .select('id, language_id, code, name, short_name, is_default')
      .order('id');
    
    if (error) throw error;
    return (data || []).map(v => ({
      id: v.id,
      language_id: v.language_id,
      code: v.code,
      name: v.name,
      short_name: v.short_name || v.code,
      is_default: v.is_default || false
    }));
  } catch (err) {
    console.error('[bibleDb] getDbVersionsWithVerses error:', err);
    return [];
  }
}

/**
 * Get all books
 */
export async function getDbAllBooks(languageId?: number): Promise<DbBookItem[]> {
  try {
    let query = supabase
      .from('books')
      .select('id, testament_id, classification_id, code, order_index, chapters_count');
    
    const { data: booksData, error: booksError } = await query.order('order_index');
    
    if (booksError) throw booksError;
    if (!booksData || booksData.length === 0) return [];

    let bookNames: Record<number, string> = {};
    
    if (languageId !== undefined) {
      const { data: transData } = await supabase
        .from('book_translations')
        .select('book_id, name')
        .eq('language_id', languageId);
      
      transData?.forEach(t => {
        bookNames[t.book_id] = t.name;
      });
    }

    if (Object.keys(bookNames).length === 0) {
      const { data: defaultTrans } = await supabase
        .from('book_translations')
        .select('book_id, language_id, name')
        .eq('language_id', 3);
      
      defaultTrans?.forEach(t => {
        if (!bookNames[t.book_id]) {
          bookNames[t.book_id] = t.name;
        }
      });
    }

    return booksData.map(b => ({
      id: b.id,
      code: b.code,
      name: bookNames[b.id] || b.code,
      testament_id: b.testament_id,
      classification_id: b.classification_id,
      order_index: b.order_index,
      chapters_count: b.chapters_count || 1
    }));
  } catch (err) {
    console.error('[bibleDb] getDbAllBooks error:', err);
    return [];
  }
}

/**
 * Get database stats
 */
export async function getDbStats(): Promise<DbStats | null> {
  try {
    const [books, verses, versions, chapters] = await Promise.all([
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('verses').select('*', { count: 'exact', head: true }),
      supabase.from('bible_versions').select('*', { count: 'exact', head: true }),
      supabase.from('chapters').select('*', { count: 'exact', head: true })
    ]);

    return {
      booksCount: books.count || 0,
      versesCount: verses.count || 0,
      versionsCount: versions.count || 0,
      chaptersCount: chapters.count || 0
    };
  } catch (err) {
    console.error('[bibleDb] getDbStats error:', err);
    return null;
  }
}

/**
 * Get verses for a specific chapter and version
 */
export async function getDbChapterVerses(
  bookId: number | string,
  chapterNum: number,
  versionCode: string = 'LSG',
  verseNumber?: number
): Promise<DbVerseItem[]> {
  try {
    let bookIdNum: number;
    
    if (typeof bookId === 'string') {
      const { data: bookData } = await supabase
        .from('books')
        .select('id')
        .eq('code', bookId)
        .single();
      
      if (!bookData) {
        console.warn('[bibleDb] Book not found:', bookId);
        return [];
      }
      bookIdNum = bookData.id;
    } else {
      bookIdNum = bookId;
    }

    // Get the version
    const { data: versionData } = await supabase
      .from('bible_versions')
      .select('id')
      .eq('code', versionCode)
      .single();

    if (!versionData) {
      console.warn('[bibleDb] Version not found:', versionCode);
      return [];
    }

    // Get the chapter
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('id')
      .eq('book_id', bookIdNum)
      .eq('number', chapterNum)
      .single();

    if (!chapterData) {
      console.warn('[bibleDb] Chapter not found:', bookIdNum, chapterNum);
      return [];
    }

    // Get verses with their text
    const { data: versesData, error: versesError } = await supabase
      .from('verses')
      .select(`
        id,
        chapter_id,
        verse_number,
        reference_code
      `)
      .eq('chapter_id', chapterData.id)
      .order('verse_number');

    if (versesError) throw versesError;
    if (!versesData || versesData.length === 0) return [];

    const verseIds = versesData.map(v => v.id);

    const { data: textsData, error: textsError } = await supabase
      .from('verse_texts')
      .select('verse_id, text')
      .eq('version_id', versionData.id)
      .in('verse_id', verseIds);

    if (textsError) {
      console.warn('[bibleDb] verse_texts error:', textsError);
    }

    const textMap: Record<number, string> = {};
    textsData?.forEach(t => {
      textMap[t.verse_id] = t.text;
    });

    let result: DbVerseItem[] = versesData.map(v => ({
      id: v.id,
      chapter_id: v.chapter_id,
      verse_number: v.verse_number,
      reference_code: v.reference_code,
      text: textMap[v.id] || ''
    }));

    if (verseNumber !== undefined) {
      result = result.filter(v => v.verse_number === verseNumber);
    }

    return result;
  } catch (err) {
    console.error('[bibleDb] getDbChapterVerses error:', err);
    return [];
  }
}

/**
 * Search verses in database
 */
export async function searchDbVerses(
  query: string,
  versionCode: string = 'LSG',
  limit: number = 20
): Promise<DbSearchResult[]> {
  try {
    const { data: versionData } = await supabase
      .from('bible_versions')
      .select('id')
      .eq('code', versionCode)
      .single();

    if (!versionData) return [];

    const { data, error } = await supabase
      .from('verse_texts')
      .select(`
        id,
        text,
        verse_id,
        verses!inner(
          id,
          verse_number,
          reference_code,
          chapters!inner(
            id,
            number,
            books!inner(
              id,
              code
            )
          )
        )
      `)
      .ilike('text', `%${query}%`)
      .eq('version_id', versionData.id)
      .limit(limit);

    if (error) throw error;
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      text: row.text,
      verseId: row.verses.id,
      verseNumber: row.verses.verse_number,
      referenceCode: row.verses.reference_code,
      chapterNumber: row.verses.chapters.number,
      bookId: row.verses.chapters.books.id,
      bookCode: row.verses.chapters.books.code
    }));
  } catch (err) {
    console.error('[bibleDb] searchDbVerses error:', err);
    return [];
  }
}

/**
 * Get verse treasures (cross-references)
 */
export async function getDbVerseTreasures(
  verseId: number,
  languageCode: string = 'fr',
  versionCode: string = 'LSG'
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_verse_treasures', {
        p_reference_code: verseId.toString(),
        p_language_code: languageCode,
        p_version_code: versionCode
      });

    if (error) {
      console.warn('[bibleDb] getDbVerseTreasures RPC error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[bibleDb] getDbVerseTreasures error:', err);
    return [];
  }
}