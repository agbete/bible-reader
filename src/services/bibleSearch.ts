import { supabase } from '@/integrations/supabase/client';

export type SearchMatchMode = 'contains' | 'word' | 'prefix' | 'suffix';

export interface BibleSearchOptions {
  query: string;
  /** Une ou plusieurs versions */
  versionIds: number[];
  mode: SearchMatchMode;
  caseSensitive: boolean;
  /** Livres où chercher ; absent = toute la Bible */
  bookIds?: number[];
}

export interface BibleSearchHit {
  verseId: number;
  versionId: number;
  referenceCode: string;
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleSearchResponse {
  hits: BibleSearchHit[];
  /** Nombre total de textes trouvés (un verset compte une fois par version) */
  total: number;
}

/**
 * Supabase renvoie au plus 1000 lignes par requête (réglage « Max rows » du projet) :
 * on lit les résultats par paquets successifs, sans plafond côté application.
 */
const PAGE_SIZE = 1000;

/**
 * Échappe le texte pour une expression régulière PostgreSQL sans barre oblique inverse :
 * chaque caractère spécial est placé entre crochets ([.] [*] …) ; les espaces deviennent [[:space:]]+.
 */
function toPostgresRegex(text: string): string {
  return text
    .trim()
    .replace(/[\\^\]]/g, '')
    .split(/\s+/)
    .map(word => word.replace(/[.*+?$|()[{}]/g, ch => `[${ch}]`))
    .join('[[:space:]]+');
}

/** Lettres et chiffres (accents compris) : ce qui borne un « mot » */
const PG_WORD_CHAR = '[:alpha:][:digit:]';

function buildPattern(query: string, mode: SearchMatchMode): string {
  const body = toPostgresRegex(query);
  const before = `(^|[^${PG_WORD_CHAR}])`;
  const after = `($|[^${PG_WORD_CHAR}])`;
  switch (mode) {
    case 'word': return `${before}${body}${after}`;
    case 'prefix': return `${before}${body}`;
    case 'suffix': return `${body}${after}`;
    default: return body;
  }
}

/** Expression régulière JavaScript équivalente, pour surligner les correspondances */
export function buildHighlightRegex(query: string, mode: SearchMatchMode, caseSensitive: boolean): RegExp | null {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const body = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const before = mode === 'word' || mode === 'prefix' ? '(?<![\\p{L}\\p{N}])' : '';
  const after = mode === 'word' || mode === 'suffix' ? '(?![\\p{L}\\p{N}])' : '';
  return new RegExp(`${before}${body}${after}`, caseSensitive ? 'gu' : 'giu');
}

/** Recherche un mot ou une expression dans toute la Bible (ou dans une sélection de livres) */
export async function searchBible(options: BibleSearchOptions): Promise<BibleSearchResponse> {
  const { query, versionIds, mode, caseSensitive, bookIds } = options;
  const pattern = buildPattern(query, mode);

  const fetchPage = async (from: number, withCount: boolean) => {
    let request = supabase
      .from('verse_texts')
      .select('verse_id, version_id, text, verses!inner(verse_number, reference_code, chapters!inner(number, book_id))', withCount ? { count: 'exact' } : undefined)
      .in('version_id', versionIds)
      .filter('text', caseSensitive ? 'match' : 'imatch', pattern)
      .order('verse_id', { ascending: true })
      .order('version_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (bookIds && bookIds.length > 0) request = request.in('verses.chapters.book_id', bookIds);
    const { data, error, count } = await request;
    if (error) throw error;
    return { rows: (data || []) as any[], count: count ?? 0 };
  };

  // Premier paquet avec le total, puis les paquets suivants en parallèle
  const first = await fetchPage(0, true);
  const total = first.count;
  const pages = [first.rows];
  if (first.rows.length === PAGE_SIZE && total > PAGE_SIZE) {
    const offsets: number[] = [];
    for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);
    const rest = await Promise.all(offsets.map(from => fetchPage(from, false)));
    rest.forEach(page => pages.push(page.rows));
  }

  const hits: BibleSearchHit[] = [];
  pages.flat().forEach(row => {
    const verse = row.verses;
    const chapter = verse?.chapters;
    if (!verse || !chapter) return;
    hits.push({
      verseId: row.verse_id,
      versionId: row.version_id,
      referenceCode: verse.reference_code,
      bookId: chapter.book_id,
      chapter: chapter.number,
      verse: verse.verse_number,
      text: row.text,
    });
  });

  return { hits, total: Math.max(total, hits.length) };
}
