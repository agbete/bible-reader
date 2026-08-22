import { supabase } from '@/integrations/supabase/client';

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
 * Check connection to Supabase and inspect table counts & permissions
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
      const { count, error, status } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42501' || error.message.toLowerCase().includes('permission denied') || error.message.toLowerCase().includes('violates row-level security')) {
          results.push({
            name: tableName,
            count: null,
            status: 'rls_restricted',
            error: error.message
          });
        } else {
          results.push({
            name: tableName,
            count: null,
            status: 'error',
            error: error.message
          });
        }
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
        error: err?.message || 'Erreur réseau ou inconnue'
      });
    }
  }

  // Fetch available versions
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
 * Fetch books list with translations from Supabase
 */
export async function getDbBooks() {
  try {
    const { data: books, error } = await supabase
      .from('books')
      .select(`
        id,
        code,
        order_index,
        testament_id,
        classification_id,
        book_translations (
          name,
          language_id
        )
      `)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return books || [];
  } catch (err) {
    console.warn('[bibleDb] Erreur lors de la récupération des livres:', err);
    return [];
  }
}

/**
 * Fetch verses of a chapter from Supabase
 */
export async function getDbChapterVerses(bookCode: string, chapterNum: number, versionCode: string = 'LSG') {
  try {
    // 1. Get book
    const { data: bookData } = await supabase
      .from('books')
      .select('id, code')
      .eq('code', bookCode)
      .maybeSingle();

    if (!bookData) return null;

    // 2. Get chapter
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('id, number')
      .eq('book_id', bookData.id)
      .eq('number', chapterNum)
      .maybe<dyad-write path="src/services/bibleDb.ts" description="Service to query Bible tables from Supabase and test database connectivity">
import { supabase } from '@/integrations/supabase/client';

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
 * Check connection to Supabase and inspect table counts & permissions
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
        if (
          error.code === '42501' || 
          error.message.toLowerCase().includes('permission denied') || 
          error.message.toLowerCase().includes('violates row-level security')
        ) {
          results.push({
            name: tableName,
            count: null,
            status: 'rls_restricted',
            error: error.message
          });
        } else {
          results.push({
            name: tableName,
            count: null,
            status: 'error',
            error: error.message
          });
        }
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
        error: err?.message || 'Erreur réseau ou inconnue'
      });
    }
  }

  // Fetch available versions
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
 * Fetch books list with translations from Supabase
 */
export async function getDbBooks() {
  try {
    const { data: books, error } = await supabase
      .from('books')
      .select(`
        id,
        code,
        order_index,
        testament_id,
        classification_id,
        book_translations (
          name,
          language_id
        )
      `)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return books || [];
  } catch (err) {
    console.warn('[bibleDb] Erreur lors de la récupération des livres:', err);
    return [];
  }
}

/**
 * Fetch verses of a chapter from Supabase
 */
export async function getDbChapterVerses(bookCode: string, chapterNum: number, versionCode: string = 'LSG') {
  try {
    // 1. Get book
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('id, code')
      .ilike('code', bookCode)
      .maybeSingle();

    if (bookError || !bookData) return null;

    // 2. Get chapter
    const { data: chapterData, error: chapError } = await supabase
      .from('chapters')
      .select('id, number')
      .eq('book_id', bookData.id)
      .eq('number', chapterNum)
      .maybeSingle();

    if (chapError || !chapterData) return null;

    // 3. Get version
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, code')
      .ilike('code', versionCode)
      .maybeSingle();

    const versionId = verData?.id || 1;

    // 4. Get verses with text
    const { data: verses, error: vError } = await supabase
      .from('verses')
      .select(`
        id,
        verse_number,
        reference_code,
        verse_texts (
          text,
          version_id
        )
      `)
      .eq('chapter_id', chapterData.id)
      .order('verse_number', { ascending: true });

    if (vError || !verses) return null;

    return verses.map(v => {
      const texts<dyad-write path="src/services/bibleDb.ts" description="Service to query Bible tables from Supabase and test database connectivity">
import { supabase } from '@/integrations/supabase/client';

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
 * Check connection to Supabase and inspect table counts & permissions
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
        if (
          error.code === '42501' || 
          error.message.toLowerCase().includes('permission denied') || 
          error.message.toLowerCase().includes('violates row-level security')
        ) {
          results.push({
            name: tableName,
            count: null,
            status: 'rls_restricted',
            error: error.message
          });
        } else {
          results.push({
            name: tableName,
            count: null,
            status: 'error',
            error: error.message
          });
        }
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
        error: err?.message || 'Erreur réseau ou inconnue'
      });
    }
  }

  // Fetch available versions
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
 * Fetch books list with translations from Supabase
 */
export async function getDbBooks() {
  try {
    const { data: books, error } = await supabase
      .from('books')
      .select(`
        id,
        code,
        order_index,
        testament_id,
        classification_id,
        book_translations (
          name,
          language_id
        )
      `)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return books || [];
  } catch (err) {
    console.warn('[bibleDb] Erreur lors de la récupération des livres:', err);
    return [];
  }
}

/**
 * Fetch verses of a chapter from Supabase
 */
export async function getDbChapterVerses(bookCode: string, chapterNum: number, versionCode: string = 'LSG') {
  try {
    // 1. Get book
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('id, code')
      .ilike('code', bookCode)
      .maybeSingle();

    if (bookError || !bookData) return null;

    // 2. Get chapter
    const { data: chapterData, error: chapError } = await supabase
      .from('chapters')
      .select('id, number')
      .eq('book_id', bookData.id)
      .eq('number', chapterNum)
      .maybeSingle();

    if (chapError || !chapterData) return null;

    // 3. Get version
    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, code')
      .ilike('code', versionCode)
      .maybeSingle();

    const versionId = verData?.id;

    // 4. Get verses with text
    const { data: verses, error: vError } = await supabase
      .from('verses')
      .select(`
        id,
        verse_number,
        reference_code,
        verse_texts (
          text,
          version_id
        )
      `)
      .eq('chapter_id', chapterData.id)
      .order('verse_number', { ascending: true });

    if (vError || !verses) return null;

    return verses.map(v => {
      const matchText = (v.verse_texts as any[])?.find(t => !versionId || t.version_id === versionId)?.text 
        || (v.verse_texts as any[])?.[0]?.text 
        || '';

      return {
        num: v.verse_number,
        text: matchText
      };
    });
  } catch (err) {
    console.error('[bibleDb] Erreur lors de la lecture du chapitre:', err);
    return null;
  }
}