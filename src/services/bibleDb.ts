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
 * Récupère la liste des langues disponibles
 */
export async function getDbLanguages(): Promise<DbLanguage[]> {
  try {
    const { data, error } = await supabase
      .from('languages')
      .select('id, code, name')
      .order('name', { ascending: true });

    if (error || !data) {
      console.warn('[bibleDb] Impossible de charger les langues:', error);
      return [
        { id: 1, code: 'fr', name: 'Français' },
        { id: 2, code: 'en', name: 'Anglais' },
      ];
    }
    return data;
  } catch (err) {
    console.error('[bibleDb] Erreur langues:', err);
    return [
      { id: 1, code: 'fr', name: 'Français' },
      { id: 2, code: 'en', name: 'Anglais' },
    ];
  }
}

/**
 * Récupère toutes les versions bibliques avec leur langue
 */
export async function getDbBibleVersions(): Promise<DbBibleVersion[]> {
  try {
    const { data, error } = await supabase
      .from('bible_versions')
      .select('id, language_id, code, name, short_name, is_default')
      .order('code', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn('[bibleDb] Impossible de charger les versions depuis Supabase:', error);
      return [
        { id: 1, language_id: 1, code: 'LSG', name: 'Louis Segond 1910', short_name: 'LSG', is_default: true },
        { id: 2, language_id: 1, code: 'BDS', name: 'Bible du Semeur', short_name: 'BDS', is_default: false },
        { id: 3, language_id: 1, code: 'NFC', name: 'Nouvelle Français Courant', short_name: 'NFC', is_default: false },
        { id: 4, language_id: 1, code: 'TOB', name: 'Traduction Œcuménique de la Bible', short_name: 'TOB', is_default: false },
        { id: 5, language_id: 2, code: 'KJV', name: 'King James Version', short_name: 'KJV', is_default: false },
      ];
    }
    return data;
  } catch (err) {
    console.error('[bibleDb] Erreur versions:', err);
    return [];
  }
}

/**
 * Test de connexion Supabase & diagnostic
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
 * Récupère les livres bibliques avec leurs traductions
 */
export async function getDbBooks(languageId?: number) {
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
 * Récupère les chapitres d'un livre
 */
export async function getDbBookChapters(bookId: number) {
  try {
    const { data, error } = await supabase
      .from('chapters')
      .select('id, number')
      .eq('book_id', bookId)
      .order('number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[bibleDb] Erreur chapitres:', err);
    return [];
  }
}

/**
 * Récupère les versets d'un chapitre pour une version donnée
 */
export async function getDbChapterVerses(bookCode: string, chapterNum: number, versionCode: string = 'LSG') {
  try {
    const { data: bookData } = await supabase
      .from('books')
      .select('id, code')
      .ilike('code', bookCode)
      .maybeSingle();

    if (!bookData) return null;

    const { data: chapterData } = await supabase
      .from('chapters')
      .select('id, number')
      .eq('book_id', bookData.id)
      .eq('number', chapterNum)
      .maybeSingle();

    if (!chapterData) return null;

    const { data: verData } = await supabase
      .from('bible_versions')
      .select('id, code')
      .ilike('code', versionCode)
      .maybeSingle();

    const versionId = verData?.id;

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
        text: matchText,
        reference: v.reference_code
      };
    });
  } catch (err) {
    console.error('[bibleDb] Erreur lors de la lecture du chapitre:', err);
    return null;
  }
}