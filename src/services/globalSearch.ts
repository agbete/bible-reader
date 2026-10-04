import { supabase } from '@/integrations/supabase/client';
import { searchDbVerses, getDbAllBooks, DbBookItem, DbSearchResult } from '@/services/bibleDb';

export type GlobalSearchCategory = 
  | 'testament' 
  | 'classification' 
  | 'book' 
  | 'chapter' 
  | 'verse';

export interface GlobalSearchResult {
  category: GlobalSearchCategory;
  label: string;
  items: any[];
  totalCount: number;
}

export interface GlobalSearchOptions {
  query: string;
  versionCode?: string;
  languageId?: number | 'ALL';
  limitPerCategory?: number;
  includeVerses?: boolean;
  includeChapters?: boolean;
  minQueryLength?: number;
}

export interface GlobalSearchResponse {
  query: string;
  totalResults: number;
  results: GlobalSearchResult[];
  duration_ms: number;
}

/**
 * Global reusable search function for the Bible app
 * Returns results structured by categories: testaments, classifications, books, chapters, verses
 */
export async function globalSearch(options: GlobalSearchOptions): Promise<GlobalSearchResponse> {
  const startTime = performance.now();
  const {
    query,
    versionCode = 'LSG',
    languageId = 'ALL',
    limitPerCategory = 8,
    includeVerses = true,
    includeChapters = true,
    minQueryLength = 2
  } = options;

  const trimmed = query.trim();
  
  // Empty response if query is too short
  if (trimmed.length < minQueryLength) {
    return {
      query: trimmed,
      totalResults: 0,
      results: [],
      duration_ms: 0
    };
  }

  const lower = trimmed.toLowerCase();
  const results: GlobalSearchResult[] = [];

  try {
    // Load all books (with language filter)
    const books = await getDbAllBooks(
      languageId === 'ALL' ? undefined : languageId
    );

    // Parallel queries
    const [testamentsRes, classificationsRes, versesRes] = await Promise.all([
      supabase.from('testaments').select('id, code, order_index'),
      supabase.from('classifications').select('id, code, testament_id, order_index'),
      includeVerses && trimmed.length >= 3
        ? searchDbVerses(trimmed, versionCode, limitPerCategory)
        : Promise.resolve([] as DbSearchResult[])
    ]);

    // Process Testaments
    if (testamentsRes.data && testamentsRes.data.length > 0) {
      const { data: testTransData } = await supabase
        .from('testament_translations')
        .select('testament_id, language_id, name')
        .eq('language_id', 2); // French

      const transMap = new Map<number, string>();
      testTransData?.forEach(t => transMap.set(t.testament_id, t.name));

      const matchingTestaments = testamentsRes.data.filter(t => {
        const name = transMap.get(t.id) || t.code;
        return name.toLowerCase().includes(lower) || t.code.toLowerCase().includes(lower);
      });

      if (matchingTestaments.length > 0) {
        results.push({
          category: 'testament',
          label: 'Testaments',
          items: matchingTestaments.map(t => ({
            id: t.id,
            code: t.code,
            name: transMap.get(t.id) || t.code
          })),
          totalCount: matchingTestaments.length
        });
      }
    }

    // Process Classifications
    if (classificationsRes.data && classificationsRes.data.length > 0) {
      const { data: classTransData } = await supabase
        .from('classification_translations')
        .select('classification_id, language_id, name')
        .eq('language_id', 2);

      const transMap = new Map<number, string>();
      classTransData?.forEach(t => transMap.set(t.classification_id, t.name));

      const matchingClassifications = classificationsRes.data.filter(c => {
        const name = transMap.get(c.id) || c.code;
        return name.toLowerCase().includes(lower) || c.code.toLowerCase().includes(lower);
      });

      if (matchingClassifications.length > 0) {
        results.push({
          category: 'classification',
          label: 'Catégories',
          items: matchingClassifications.map(c => ({
            id: c.id,
            code: c.code,
            name: transMap.get(c.id) || c.code,
            testament_id: c.testament_id
          })),
          totalCount: matchingClassifications.length
        });
      }
    }

    // Process Books
    const matchingBooks = books.filter(b =>
      b.name.toLowerCase().includes(lower) ||
      b.code.toLowerCase().includes(lower)
    );

    if (matchingBooks.length > 0) {
      results.push({
        category: 'book',
        label: 'Livres bibliques',
        items: matchingBooks.slice(0, limitPerCategory),
        totalCount: matchingBooks.length
      });
    }

    // Process Chapters (e.g. "Jean 3", "Psaumes 23")
    if (includeChapters) {
      const chapterMatch = lower.match(/^(.+?)\s+(\d+)$/);
      if (chapterMatch) {
        const bookQuery = chapterMatch[1];
        const chapterNum = parseInt(chapterMatch[2], 10);
        const bookMatch = books.find(b =>
          b.name.toLowerCase().includes(bookQuery) ||
          b.code.toLowerCase().includes(bookQuery)
        );
        if (bookMatch && chapterNum > 0 && chapterNum <= bookMatch.chapters_count) {
          results.push({
            category: 'chapter',
            label: 'Chapitre trouvé',
            items: [{ book: bookMatch, chapter: chapterNum }],
            totalCount: 1
          });
        }
      }
    }

    // Process Verses
    if (includeVerses && versesRes && versesRes.length > 0) {
      results.push({
        category: 'verse',
        label: `Versets correspondants (${versesRes.length})`,
        items: versesRes,
        totalCount: versesRes.length
      });
    }

    const totalResults = results.reduce((acc, r) => acc + r.totalCount, 0);
    const duration = performance.now() - startTime;

    return {
      query: trimmed,
      totalResults,
      results,
      duration_ms: Math.round(duration)
    };
  } catch (err) {
    console.error('[globalSearch] Error:', err);
    return {
      query: trimmed,
      totalResults: 0,
      results: [],
      duration_ms: Math.round(performance.now() - startTime)
    };
  }
}