import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Book, 
  BookOpen, 
  Scroll, 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  Check, 
  X, 
  Bookmark,
  Hash,
  Layers
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DbBookItem } from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';
import { searchDbVerses, getDbAllBooks, DbSearchResult } from '@/services/bibleDb';

interface BookSearchSelectProps {
  booksList: DbBookItem[];
  selectedBook: DbBookItem | null;
  selectedChapter: number;
  onSelectBook: (book: DbBookItem, chapter: number) => void;
  currentVersion: string;
  isLoading?: boolean;
  testamentsList?: { id: number; code: string; name: string }[];
  classificationsList?: { id: number; name: string; code?: string; testament_id: number }[];
}

type SearchCategory = 'all' | 'testament' | 'classification' | 'book' | 'chapter' | 'verse';

interface SearchResultGroup {
  category: SearchCategory;
  label: string;
  icon: React.ReactNode;
  items: any[];
}

export const BookSearchSelect: React.FC<BookSearchSelectProps> = ({
  booksList,
  selectedBook,
  selectedChapter,
  onSelectBook,
  currentVersion,
  isLoading = false,
  testamentsList = [],
  classificationsList = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [verseResults, setVerseResults] = useState<DbSearchResult[]>([]);
  const [searchingVerses, setSearchingVerses] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced verse search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setVerseResults([]);
      return;
    }

    setSearchingVerses(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchDbVerses(query.trim(), currentVersion, 8);
        setVerseResults(results || []);
      } catch (err) {
        console.error('Erreur recherche versets:', err);
        setVerseResults([]);
      } finally {
        setSearchingVerses(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, currentVersion]);

  // Build search results grouped by category
  const searchGroups = useMemo<SearchResultGroup[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const groups: SearchResultGroup[] = [];

    // TESTAMENTS
    if (testamentsList.length > 0) {
      const matchingTestaments = testamentsList.filter(t => 
        t.name.toLowerCase().includes(trimmed) || 
        t.code.toLowerCase().includes(trimmed)
      );
      if (matchingTestaments.length > 0) {
        groups.push({
          category: 'testament',
          label: 'Testaments',
          icon: <Scroll className="w-3.5 h-3.5" />,
          items: matchingTestaments
        });
      }
    }

    // CLASSIFICATIONS
    if (classificationsList.length > 0) {
      const matchingClassifications = classificationsList.filter(c =>
        c.name.toLowerCase().includes(trimmed) ||
        (c.code && c.code.toLowerCase().includes(trimmed))
      );
      if (matchingClassifications.length > 0) {
        groups.push({
          category: 'classification',
          label: 'Catégories',
          icon: <Layers className="w-3.5 h-3.5" />,
          items: matchingClassifications
        });
      }
    }

    // BOOKS
    const matchingBooks = booksList.filter(b =>
      b.name.toLowerCase().includes(trimmed) ||
      b.code.toLowerCase().includes(trimmed)
    );
    if (matchingBooks.length > 0) {
      groups.push({
        category: 'book',
        label: 'Livres bibliques',
        icon: <Book className="w-3.5 h-3.5" />,
        items: matchingBooks.slice(0, 10)
      });
    }

    // CHAPTERS (e.g. "Jean 3" or "Psaumes 23")
    const chapterMatch = trimmed.match(/^(.+?)\s+(\d+)$/);
    if (chapterMatch) {
      const bookQuery = chapterMatch[1];
      const chapterNum = parseInt(chapterMatch[2], 10);
      const bookMatch = booksList.find(b =>
        b.name.toLowerCase().includes(bookQuery) ||
        b.code.toLowerCase().includes(bookQuery)
      );
      if (bookMatch && chapterNum > 0 && chapterNum <= bookMatch.chapters_count) {
        groups.push({
          category: 'chapter',
          label: 'Chapitre trouvé',
          icon: <Hash className="w-3.5 h-3.5" />,
          items: [{ book: bookMatch, chapter: chapterNum }]
        });
      }
    }

    // VERSES (if at least 3 characters and verse results loaded)
    if (verseResults.length > 0) {
      groups.push({
        category: 'verse',
        label: `Versets correspondants (${verseResults.length})`,
        icon: <Bookmark className="w-3.5 h-3.5" />,
        items: verseResults
      });
    }

    return groups;
  }, [query, booksList, testamentsList, classificationsList, verseResults]);

  // Flat list of all results for keyboard navigation
  const flatResults = useMemo(() => {
    const all: any[] = [];
    searchGroups.forEach(group => {
      group.items.forEach(item => all.push({ ...item, _category: group.category }));
    });
    return all;
  }, [searchGroups]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatResults[highlightedIndex];
      if (item) handleSelectItem(item._category, item);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  const handleSelectItem = (category: SearchCategory, item: any) => {
    switch (category) {
      case 'testament': {
        // Select first book of the testament
        const firstBook = booksList.find(b => b.testament_id === item.id || b.testament_code === item.code);
        if (firstBook) {
          onSelectBook(firstBook, 1);
          setIsOpen(false);
          setQuery('');
        }
        break;
      }
      case 'classification': {
        const firstBook = booksList.find(b => b.classification_id === item.id);
        if (firstBook) {
          onSelectBook(firstBook, 1);
          setIsOpen(false);
          setQuery('');
        }
        break;
      }
      case 'book': {
        onSelectBook(item, 1);
        setIsOpen(false);
        setQuery('');
        break;
      }
      case 'chapter': {
        onSelectBook(item.book, item.chapter);
        setIsOpen(false);
        setQuery('');
        break;
      }
      case 'verse': {
        const matchedBook = booksList.find(b => b.code.toLowerCase() === item.bookCode.toLowerCase());
        if (matchedBook) {
          onSelectBook(matchedBook, item.chapterNumber);
          setIsOpen(false);
          setQuery('');
        }
        break;
      }
    }
  };

  // Calculate item index within the flat results
  const getItemGlobalIndex = (category: string, localIndex: number): number => {
    let count = 0;
    for (const group of searchGroups) {
      if (group.category === category) {
        return count + localIndex;
      }
      count += group.items.length;
    }
    return -1;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button - looks like a select field */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`w-full flex items-center justify-between gap-2 pl-10 pr-4 h-11 rounded-2xl border bg-card text-sm transition-all ${
          isOpen 
            ? 'border-amber-500/60 ring-2 ring-amber-500/20' 
            : 'border-border hover:border-amber-500/40'
        }`}
      >
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        
        <div className="flex items-center gap-2 flex-1 text-left truncate">
          {selectedBook ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                {selectedBook.code}
              </span>
              <span className="font-semibold truncate">{selectedBook.name}</span>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                Chapitre {selectedChapter}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground truncate">
              Rechercher un livre, chapitre, verset ou mot-clé...
            </span>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search Input */}
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tapez un nom de livre, un chapitre (ex: Jean 3), ou un mot-clé..."
                className="pl-9 pr-9 h-10 rounded-xl border-border/80 bg-background text-sm"
              />
              {searchingVerses && (
                <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-600" />
              )}
              {!searchingVerses && query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {query && (
              <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-3 px-1">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↑↓</kbd>
                  Naviguer
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↵</kbd>
                  Sélectionner
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">ESC</kbd>
                  Fermer
                </span>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {!query.trim() ? (
              // EMPTY STATE - Show current book
              <div className="p-4 space-y-3">
                {selectedBook && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold font-mono text-xs">
                      {selectedBook.code}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{selectedBook.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Chapitre actuel : {selectedChapter} / {selectedBook.chapters_count}
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-amber-600" />
                  </div>
                )}
                
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Tapez au moins 2 caractères pour rechercher un livre, chapitre ou verset
                </div>
              </div>
            ) : searchGroups.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground space-y-2">
                <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-sm font-medium">Aucun résultat pour « {query} »</p>
                <p className="text-xs">Essayez un nom de livre, « Jean 3 », ou un mot-clé</p>
              </div>
            ) : (
              <div className="py-1">
                {searchGroups.map((group) => (
                  <div key={group.category} className="mb-1">
                    <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center gap-1.5 sticky top-0 backdrop-blur-sm">
                      {group.icon}
                      <span>{group.label}</span>
                    </div>
                    
                    {group.items.map((item: any, localIndex: number) => {
                      const globalIndex = getItemGlobalIndex(group.category, localIndex);
                      const isHighlighted = globalIndex === highlightedIndex;
                      
                      return (
                        <button
                          key={`${group.category}-${localIndex}`}
                          onClick={() => handleSelectItem(group.category, item)}
                          onMouseEnter={() => setHighlightedIndex(globalIndex)}
                          className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                            isHighlighted 
                              ? 'bg-amber-500/15' 
                              : 'hover:bg-muted/40'
                          }`}
                        >
                          {group.category === 'testament' && (
                            <>
                              <Scroll className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">({item.code})</span>
                            </>
                          )}
                          
                          {group.category === 'classification' && (
                            <>
                              <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-semibold">{item.name}</span>
                            </>
                          )}
                          
                          {group.category === 'book' && (
                            <>
                              <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                                {item.code}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate">{item.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {item.chapters_count} chapitres
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </>
                          )}
                          
                          {group.category === 'chapter' && (
                            <>
                              <Hash className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-semibold">{item.book.name}</span>
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">
                                Chapitre {item.chapter}
                              </span>
                            </>
                          )}
                          
                          {group.category === 'verse' && (
                            <>
                              <Bookmark className="w-4 h-4 text-amber-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {item.reference_code}
                                </div>
                                <div className="text-xs text-foreground/80 line-clamp-1 italic">
                                  « {item.text} »
                                </div>
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};