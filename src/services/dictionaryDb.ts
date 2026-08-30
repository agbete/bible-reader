import { supabase } from '@/integrations/supabase/client';

export interface DictionaryLanguage {
  id: number;
  code: string;
  name: string;
}

export interface Dictionary {
  id: number;
  code: string;
  name: string;
  description?: string;
  language_id: number;
  icon?: string;
  color?: string;
  is_active: boolean;
  display_order: number;
  author?: string;
}

export interface DictionaryEntry {
  id: number;
  dictionary_id: number;
  entry_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DictionaryEntryDetail extends DictionaryEntry {
  dictionary_name: string;
  dictionary_code: string;
  author?: string;
  prev_entry?: { id: number; entry_name: string };
  next_entry?: { id: number; entry_name: string };
}

export interface DictionaryFilters {
  languageId?: number;
  dictionaryId?: number;
  searchQuery?: string;
  letter?: string;
  page?: number;
  pageSize?: number;
}

export interface DictionaryEntriesResponse {
  entries: DictionaryEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get all dictionaries
 */
export async function getDictionaries(): Promise<Dictionary[]> {
  try {
    const { data, error } = await supabase
      .from('dictionaries')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[dictionaryDb] Error fetching dictionaries:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[dictionaryDb] Exception:', err);
    return [];
  }
}

/**
 * Get dictionaries by language
 */
export async function getDictionariesByLanguage(languageId: number): Promise<Dictionary[]> {
  try {
    const { data, error } = await supabase
      .from('dictionaries')
      .select('*')
      .eq('language_id', languageId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[dictionaryDb] Error fetching dictionaries by language:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[dictionaryDb] Exception:', err);
    return [];
  }
}

/**
 * Get all available letters (A-Z) for a dictionary
 */
export async function getAvailableLetters(dictionaryId?: number, languageId?: number): Promise<string[]> {
  try {
    let query = supabase
      .from('dictionary_entries')
      .select('entry_name');

    if (dictionaryId) {
      query = query.eq('dictionary_id', dictionaryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[dictionaryDb] Error fetching letters:', error.message);
      return [];
    }

    // Extract first letters and deduplicate
    const letters = new Set<string>();
    data?.forEach((entry: any) => {
      if (entry.entry_name && entry.entry_name.length > 0) {
        const firstLetter = entry.entry_name.charAt(0).toUpperCase();
        if (/^[A-Z]$/.test(firstLetter)) {
          letters.add(firstLetter);
        }
      }
    });

    return Array.from(letters).sort();
  } catch (err) {
    console.error('[dictionaryDb] Exception:', err);
    return [];
  }
}

/**
 * Get dictionary entries with filters and pagination
 */
export async function getDictionaryEntries(filters: DictionaryFilters): Promise<DictionaryEntriesResponse> {
  const {
    languageId,
    dictionaryId,
    searchQuery,
    letter,
    page = 1,
    pageSize = 100
  } = filters;

  try {
    let query = supabase
      .from('dictionary_entries')
      .select('*', { count: 'exact' });

    // Apply dictionary filter
    if (dictionaryId) {
      query = query.eq('dictionary_id', dictionaryId);
    }

    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('entry_name', `%${searchQuery.trim()}%`);
    }

    // Apply alphabetical filter
    if (letter) {
      query = query.gte('entry_name', `${letter}A`)
                .lt('entry_name', `${letter}z`);
    }

    // Apply sorting
    query = query.order('entry_name', { ascending: true });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[dictionaryDb] Error fetching entries:', error.message);
      return {
        entries: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0
      };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      entries: data || [],
      totalCount,
      page,
      pageSize,
      totalPages
    };
  } catch (err) {
    console.error('[dictionaryDb] Exception:', err);
    return {
      entries: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0
    };
  }
}

/**
 * Get a single dictionary entry by ID with details
 */
export async function getDictionaryEntryById(
  entryId: number,
  dictionaryId: number
): Promise<DictionaryEntryDetail | null> {
  try {
    // Get the entry with dictionary info
    const { data: entry, error: entryError } = await supabase
      .from('dictionary_entries')
      .select('*')
      .eq('id', entryId)
      .eq('dictionary_id', dictionaryId)
      .single();

    if (entryError || !entry) {
      console.error('[dictionaryDb] Entry not found:', entryId);
      return null;
    }

    // Get dictionary info
    const { data: dictionary } = await supabase
      .from('dictionaries')
      .select('name, code, author')
      .eq('id', dictionaryId)
      .single();

    // Get previous entry
    const { data: prevEntry } = await supabase
      .from('dictionary_entries')
      .select('id, entry_name')
      .eq('dictionary_id', dictionaryId)
      .lt('entry_name', entry.entry_name)
      .order('entry_name', { ascending: false })
      .limit(1)
      .single();

    // Get next entry
    const { data: nextEntry } = await supabase
      .from('dictionary_entries')
      .select('id, entry_name')
      .eq('dictionary_id', dictionaryId)
      .gt('entry_name', entry.entry_name)
      .order('entry_name', { ascending: true })
      .limit(1)
      .single();

    return {
      ...entry,
      dictionary_name: dictionary?.name || '',
      dictionary_code: dictionary?.code || '',
      author: dictionary?.author,
      prev_entry: prevEntry ? { id: prevEntry.id, entry_name: prevEntry.entry_name } : undefined,
      next_entry: nextEntry ? { id: nextEntry.id, entry_name: nextEntry.entry_name } : undefined
    };
  } catch (err) {
    console.error('[dictionaryDb] Exception:', err);
    return null;
  }
}

/**
 * Get total entry count for a dictionary
 */
export async function getDictionaryEntryCount(dictionaryId: number): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('dictionary_entries')
      .select('*', { count: 'exact', head: true })
      .eq('dictionary_id', dictionaryId);

    if (error) {
      console.error('[dictionaryDb] Error counting entries:', error.message);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('[dictionaryDb] Exception:', err);
    return 0;
  }
}