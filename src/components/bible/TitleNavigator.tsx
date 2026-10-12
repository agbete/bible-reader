import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ListTree, Loader2, Search, X } from 'lucide-react';
import { DbBookItem, DbBookTitleItem, getDbBookTitles } from '@/services/bibleDb';

const TITLE_LEVEL = 4;

// Lowercase without accents, so "eden" matches "Éden"
const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Wraps each occurrence of the query in <mark>, comparing without accents
const highlight = (text: string, query: string) => {
  const q = normalize(query.trim());
  if (!q) return text;
  const normalizedText = normalize(text);
  // NFD normalisation keeps one char per base letter for Latin text, so indexes line up
  if (normalizedText.length !== text.length) return text;
  const parts: React.ReactNode[] = [];
  let from = 0;
  let idx = normalizedText.indexOf(q);
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx));
    parts.push(
      <mark key={idx} className="bg-amber-300/60 dark:bg-amber-500/40 text-inherit rounded-sm">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    from = idx + q.length;
    idx = normalizedText.indexOf(q, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
};

interface TitleNavigatorProps {
  selectedBook: DbBookItem;
  selectedChapter: number;
  languageId?: number;
  onSelectTitle: (chapter: number, verseNumber: number, verseId: number) => void;
  compact?: boolean;
}

export const TitleNavigator: React.FC<TitleNavigatorProps> = ({
  selectedBook,
  selectedChapter,
  languageId,
  onSelectTitle,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [titles, setTitles] = useState<DbBookTitleItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Last title picked (list or arrows), so arrows can move between titles of the same chapter
  const [activeTitleId, setActiveTitleId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentChapterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDbBookTitles(selectedBook.id, TITLE_LEVEL, languageId).then(result => {
      if (!cancelled) {
        setTitles(result);
        setActiveTitleId(null);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedBook.id, languageId]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Bring the current chapter into view and focus the search when the list opens; clear the search on close
  useEffect(() => {
    if (isOpen) {
      currentChapterRef.current?.scrollIntoView({ block: 'start' });
      searchInputRef.current?.focus();
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const filteredTitles = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return titles;
    return titles.filter(t => normalize(t.title).includes(q));
  }, [titles, query]);

  const titlesByChapter = useMemo(() => {
    const groups = new Map<number, DbBookTitleItem[]>();
    filteredTitles.forEach(t => {
      if (!groups.has(t.chapter)) groups.set(t.chapter, []);
      groups.get(t.chapter)!.push(t);
    });
    return Array.from(groups.entries());
  }, [filteredTitles]);

  // Current title: the one last picked if still in this chapter, otherwise the first
  // title of the chapter, otherwise the last title before it
  const currentIndex = useMemo(() => {
    const activeIndex = titles.findIndex(t => t.verse_id === activeTitleId);
    if (activeIndex >= 0 && titles[activeIndex].chapter === selectedChapter) return activeIndex;
    const firstInChapter = titles.findIndex(t => t.chapter === selectedChapter);
    if (firstInChapter >= 0) return firstInChapter;
    let lastBefore = -1;
    titles.forEach((t, i) => { if (t.chapter < selectedChapter) lastBefore = i; });
    return lastBefore;
  }, [titles, activeTitleId, selectedChapter]);
  const currentTitle = currentIndex >= 0 ? titles[currentIndex] : null;
  const prevTitle = currentIndex > 0 ? titles[currentIndex - 1] : null;
  const nextTitle = currentIndex < titles.length - 1 ? titles[currentIndex + 1] : null;

  const goToTitle = (t: DbBookTitleItem) => {
    setActiveTitleId(t.verse_id);
    onSelectTitle(t.chapter, t.verse_number, t.verse_id);
  };

  const hasTitles = titles.length > 0;
  const arrowClass = 'h-full px-1 flex items-center rounded text-white/80 hover:text-white hover:bg-white/15 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`h-9 max-w-[18rem] px-0.5 rounded-md border border-white/30 bg-white/10 text-white text-xs flex items-center gap-0.5 transition-colors hover:border-white/60 ${compact ? 'xl:h-6' : ''} ${
          isOpen ? 'border-white ring-2 ring-white/30' : ''
        } ${!loading && !hasTitles ? 'opacity-50' : ''}`}
      >
        {/* PREVIOUS TITLE */}
        <button
          type="button"
          disabled={!prevTitle}
          onClick={() => prevTitle && goToTitle(prevTitle)}
          className={arrowClass}
          title={prevTitle ? `Titre précédent : ${prevTitle.title}` : 'Aucun titre précédent'}
          aria-label="Titre précédent"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          disabled={!loading && !hasTitles}
          className="h-full min-w-0 flex-1 px-1 flex items-center gap-1.5 disabled:cursor-not-allowed"
          title={hasTitles ? 'Naviguer par titre' : 'Aucun titre pour ce livre'}
          aria-label="Naviguer par titre"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
          ) : (
            <ListTree className="w-3.5 h-3.5 text-white shrink-0" />
          )}
          <span className="truncate">
            {currentTitle?.title ?? (hasTitles ? 'Titres' : 'Aucun titre')}
          </span>
          <ChevronDown className={`w-3 h-3 text-white/80 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* NEXT TITLE */}
        <button
          type="button"
          disabled={!nextTitle}
          onClick={() => nextTitle && goToTitle(nextTitle)}
          className={arrowClass}
          title={nextTitle ? `Titre suivant : ${nextTitle.title}` : 'Aucun titre suivant'}
          aria-label="Titre suivant"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && hasTitles && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[min(24rem,calc(100vw-2rem))] bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-2 border-b border-border bg-amber-50 dark:bg-amber-950/60 text-xs font-bold text-amber-700 dark:text-amber-300">
            {selectedBook.name}
          </div>
          <div className="p-1.5 border-b border-border">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Entrée : aller au premier titre trouvé
                  if (e.key === 'Enter' && filteredTitles.length > 0) {
                    e.preventDefault();
                    goToTitle(filteredTitles[0]);
                    setIsOpen(false);
                  }
                }}
                placeholder="Rechercher un mot ou une expression..."
                className="w-full h-8 pl-7 pr-7 rounded-md border border-border bg-background text-xs outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {query.trim() && (
              <div className="mt-1 px-1 text-[10px] text-muted-foreground">
                {filteredTitles.length} titre{filteredTitles.length > 1 ? 's' : ''} trouvé{filteredTitles.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5 font-cambria">
            {titlesByChapter.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground font-sans">
                Aucun titre ne contient « {query.trim()} »
              </div>
            )}
            {titlesByChapter.map(([chapter, chapterTitles]) => (
              <div
                key={chapter}
                ref={chapter === (currentTitle?.chapter ?? selectedChapter) ? currentChapterRef : undefined}
                className="mb-1"
              >
                <div className={`px-2 py-1 text-xs font-extrabold ${
                  chapter === selectedChapter ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'
                }`}>
                  Chapitre {chapter}
                </div>
                {chapterTitles.map(t => (
                  <button
                    key={t.verse_id}
                    type="button"
                    onClick={() => {
                      goToTitle(t);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-start justify-between gap-2 px-2 py-1 rounded-md text-left text-sm hover:bg-muted/60 transition-colors ${
                      currentTitle?.verse_id === t.verse_id ? 'bg-amber-500/15' : ''
                    }`}
                  >
                    <span className="leading-snug flex-1 min-w-0 pl-[10px]">{highlight(t.title, query)}</span>
                    <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 pt-0.5 shrink-0 text-right">
                      {t.chapter}:{t.verse_number}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TitleNavigator;
