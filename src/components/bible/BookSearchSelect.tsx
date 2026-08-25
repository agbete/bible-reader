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

// Helper to remove accents and diacritics
const removeDiacritics = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u36ff]/g, "");
};

type SearchCategory = 'testament' | 'classification' | 'book' | 'chapter' | 'verse';

interface SearchResultGroup {
  category: SearchCategory;
  label: string;
  icon: React.ReactNode;
  items: any[];
}

interface BookSearchSelectProps {
  booksList: DbBookItem[];
  selectedBook: DbBookItem | null;
  selectedChapter: number;
  onSelectBook: (book: DbBookItem, chapter: number) => void;
  currentVersion: string;
  isLoading?: boolean;
  testamentsList: { id: number; code: string; name: string }[];
  classificationsList: { id: number; name: string; code?: string; testament_id: number }[];
  testamentNames: Map<number, string>;
  classificationNames: Map<number, string>;
}

export const BookSearchSelect: React.FC<BookSearchSelectProps> = ({
  booksList,
  selectedBook,
  selectedChapter,
  onSelectBook,
  currentVersion,
  isLoading = false,
  testamentsList,
  classificationsList,
  testamentNames,
  classificationNames
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

  // Build search results grouped by testament then classification
  const searchGroups = useMemo<SearchResultGroup[]>(() => {
    const trimmed = query.trim();
    const normalizedQuery = removeDiacritics(trimmed.toLowerCase());

    if (!trimmed) {
      // Show all books grouped by testament then classification
      const testamentMap = new Map<number, Map<number, DbBookItem[]>>();
      
      booksList.forEach(book => {
        const testamentId = book.testament_id;
        const classificationId = book.classification_id;
        
        if (!testamentMap.has(testamentId)) {
          testamentMap.set(testamentId, new Map());
        }
        const classMap = testamentMap.get(testamentId)!;
        if (!classMap.has(classificationId)) {
          classMap.set(classificationId, []);
        }
        classMap.get(classificationId)!.push(book);
      });

      const flattenedGroups: SearchResultGroup[] = [];
      
      testamentMap.forEach((classMap, testamentId) => {
        const testamentName = testamentNames.get(testamentId) || 
          testamentsList.find(t => t.id === testamentId)?.name || 
          `Testament ${testamentId}`;
          
        classMap.forEach((books, classificationId) => {
          const classificationName = classificationNames.get(classificationId) || 
            classificationsList.find(c => c.id === classificationId)?.name || 
            `Classification ${classificationId}`;
          
          flattenedGroups.push({
            category: 'testament-classification',
            label: `${testamentName} > ${classificationName}`,
            icon: <Layers className="w-3.5 h-3.5" />,
            items: [{
              testamentId,
              classificationId,
              testamentName,
              classificationName,
              books
            }]
          });
        });
      });
      
      return flattenedGroups;
    }

    // Non-empty query: filter books
    const normalizedQueryNoAccents = removeDiacritics(trimmed.toLowerCase());
    
    const matchingBooks = booksList.filter(book => {
      const bookName = removeDiacritics(book.name.toLowerCase());
      const bookCode = removeDiacritics(book.code.toLowerCase());
      return bookName.includes(normalizedQueryNoAccents) || 
             bookCode.includes(normalizedQueryNoAccents);
    });
    
    // Group matching books by testament then classification
    const bookGroupsMap = new Map<string, Map<string, DbBookItem[]>>();
    
    matchingBooks.forEach(book => {
      const testamentId = book.testament_id;
      const classificationId = book.classification_id;
      
      const testamentName = testamentNames.get(testamentId) || 
        testamentsList.find(t => t.id === testamentId)?.name || 
        `Testament ${testamentId}`;
      
      const classificationName = classificationNames.get(classificationId) || 
        classificationsList.find(c => c.id === classificationId)?.name || 
        `Classification ${classificationId}`;
      
      if (!bookGroupsMap.has(testamentName)) {
        bookGroupsMap.set(testamentName, new Map());
      }
      const classMap = bookGroupsMap.get(testamentName)!;
      if (!classMap.has(classificationName)) {
        classMap.set(classificationName, []);
      }
      classMap.get(classificationName)!.push(book);
    });
    
    // Build groups from matching books
    const groups: SearchResultGroup[] = [];
    
    bookGroupsMap.forEach((classMap, testamentName) => {
      classMap.forEach((books, classificationName) => {
        groups.push({
          category: 'testament-classification',
          label: `${testamentName} > ${classificationName}`,
          icon: <Layers className="w-3.5 h-3.5" />,
          items: [{
            testamentName,
            classificationName,
            books
          }]
        });
      });
    });
    
    // Add verse results if available
    if (verseResults.length > 0) {
      const verseGroupsMap = new Map<string, Map<string, DbSearchResult[]>>();
      
      verseResults.forEach(verse => {
        const book = booksList.find(b => 
          b.code.toLowerCase() === verse.bookCode.toLowerCase()
        );
        
        if (book) {
          const testamentId = book.testament_id;
          const classificationId = book.classification_id;
          
          const testamentName = testamentNames.get(testamentId) || 
            testamentsList.find(t => t.id === testamentId)?.name || 
            `Testament ${testamentId}`;
          
          const classificationName = classificationNames.get(classificationId) || 
            classificationsList.find(c => c.id === classificationId)?.name || 
            `Classification ${classificationId}`;
          
          if (!verseGroupsMap.has(testamentName)) {
            verseGroupsMap.set(testamentName, new Map());
          }
          const classMap = verseGroupsMap.get(testamentName)!;
          if (!classMap.has(classificationName)) {
            classMap.set(classificationName, []);
          }
          classMap.get(classificationName)!.push(verse);
        }
      });
      
      verseGroupsMap.forEach((classMap, testamentName) => {
        classMap.forEach((verses, classificationName) => {
          groups.push({
            category: 'verse',
            label: `${testamentName} > ${classificationName} (Versets)`,
            icon: <Bookmark className="w-3.5 h-3.5" />,
            items: [{
              testamentName,
              classificationName,
              verses
            }]
          });
        });
      });
    }
    
    return groups;
  }, [query, booksList, testamentNames, classificationNames, testamentsList, classificationsList, verseResults]);

  // Flat list of all results for keyboard navigation
  const flatResults = useMemo(() => {
    const all: any[] = [];
    searchGroups.forEach(group => {
      group.items.forEach(item => all.push({ ...item, _category: group.category, _groupLabel: group.label }));
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
        const matchedBook = booksList.find(b => 
          b.code.toLowerCase() === item.bookCode.toLowerCase()
        );
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
      {/* Trigger button */}
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
              Rechercher un livre, chapitre, verset ou mot-cle...
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
                placeholder="Tapez un nom de livre, un chapitre (ex: Jean 3), ou un mot-cle..."
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
                  Selectionner
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
              <div className="p-4">
                {searchGroups.length > 0 ? (
                  <div className="space-y-2">
                    {searchGroups.map((group, groupIndex) => (
                      <div key={groupIndex} className="mb-3">
                        <div className="flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 rounded-t-xl">
                          {group.icon}
                          <span>{group.label}</span>
                        </div>
                        <div className="space-y-1 border border-t-0 border-border rounded-b-xl p-2">
                          {group.items.map((item: any, itemIndex: number) => (
                            <div key={itemIndex} className="space-y-1">
                              {item.books.map((book: DbBookItem, bookIndex: number) => (
                                <div 
                                  key={bookIndex} 
                                  onClick={() => {
                                    onSelectBook(book, 1);
                                    setIsOpen(false);
                                    setQuery('');
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                  <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                                    {book.code}
                                  </span>
                                  <span className="font-semibold truncate">{book.name}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                    <p className="text-sm">Aucun livre disponible</p>
                  </div>
                )}
              </div>
            ) : searchGroups.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-sm">Aucun resultat pour « {query} »</p>
                <p className="text-xs">Essayez un nom de livre, « Jean 3 », ou un mot-cle</p>
              </div>
            ) : (
              <div className="py-1">
                {searchGroups.map((group) => (
                  <div key={group.category} className="mb-1">
                    <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center gap-1.5">
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
                          className={`w-full px-4 py-2.5 text-left text-sm flex flex-col gap-2 transition-colors ${
                            isHighlighted 
                              ? 'bg-amber-500/15' 
                              : 'hover:bg-muted/40'
                          }`}
                        >
                          {group.category === 'testament-classification' && (
                            <div className="space-y-1">
                              {item.books.map((book: DbBookItem, bookIndex: number) => (
                                <div key={bookIndex} className="flex items-center gap-2">
                                  <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                                    {book.code}
                                  </span>
                                  <span className="font-semibold truncate">{book.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {group.category === 'verse' && (
                            <div className="space-y-1">
                              {item.verses && item.verses.map((verse: DbSearchResult, verseIndex: number) => (
                                <div key={verseIndex} className="flex items-center gap-2">
                                  <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                                    {verse.bookCode}
                                  </span>
                                  <span className="font-semibold truncate">{verse.reference_code}</span>
                                </div>
                              ))}
                            </div>
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