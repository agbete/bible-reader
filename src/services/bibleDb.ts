/**
 * 5. Récupère les titres de sections (title_translations) pour une liste de versets
 * CORRECTION: Utilise directement language_id au lieu de mapper par code
 */
export async function getDbVerseTitles(verseIds: number[], languageId?: number): Promise<Record<number, Record<string, string>>> {
  if (!verseIds || verseIds.length === 0) return {};
  
  try {
    console.log('[bibleDb] Fetching titles for verseIds:', verseIds.length, 'languageId:', languageId);
    
    // Si languageId est fourni, l'utiliser directement (c'est le cas quand on vient de la version sélectionnée)
    let query = supabase
      .from('title_translations')
      .select('verse_id, language_id, titles')
      .in('verse_id', verseIds);

    if (languageId !== undefined) {
      query = query.eq('language_id', languageId);
    } else {
      // Sinon, essayer sans filtre d'abord
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

    // Fallback: sans filtre de langue
    let finalData = data;
    if (!finalData || finalData.length === 0) {
      console.log('[bibleDb] Aucun titre avec language_id, tentative sans filtre...');
      const { data: fallbackData } = await supabase
        .from('title_translations')
        .select('verse_id, language_id, titles')
        .in('verse_id', verseIds);
      finalData = fallbackData;
    }

    // Fallback: language_id courants
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