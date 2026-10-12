import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { DbBookItem } from '@/services/bibleDb';

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
  compact?: boolean;
}

interface TestamentColumn {
  testamentName: string;
  groups: { classificationName: string; books: DbBookItem[] }[];
}

export const BookSearchSelect: React.FC<BookSearchSelectProps> = ({
  booksList,
  selectedBook,
  selectedChapter,
  onSelectBook,
  testamentsList,
  classificationsList,
  testamentNames,
  classificationNames,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentBookIndex = selectedBook ? booksList.findIndex(b => b.id === selectedBook.id) : -1;
  const prevBook = currentBookIndex > 0 ? booksList[currentBookIndex - 1] : null;
  const nextBook = currentBookIndex >= 0 && currentBookIndex < booksList.length - 1 ? booksList[currentBookIndex + 1] : null;

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
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
  }, []);

  // One column per testament, each holding its books grouped by classification
  const testamentColumns = useMemo<TestamentColumn[]>(() => {
    const testamentMap = new Map<number, Map<number, DbBookItem[]>>();

    booksList.forEach(book => {
      if (!testamentMap.has(book.testament_id)) {
        testamentMap.set(book.testament_id, new Map());
      }
      const classMap = testamentMap.get(book.testament_id)!;
      if (!classMap.has(book.classification_id)) {
        classMap.set(book.classification_id, []);
      }
      classMap.get(book.classification_id)!.push(book);
    });

    return Array.from(testamentMap.entries()).map(([testamentId, classMap]) => ({
      testamentName: testamentNames.get(testamentId) ||
        testamentsList.find(t => t.id === testamentId)?.name ||
        `Testament ${testamentId}`,
      groups: Array.from(classMap.entries()).map(([classificationId, books]) => ({
        classificationName: classificationNames.get(classificationId) ||
          classificationsList.find(c => c.id === classificationId)?.name ||
          `Classification ${classificationId}`,
        books
      }))
    }));
  }, [booksList, testamentNames, classificationNames, testamentsList, classificationsList]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger: previous book · book name · next book */}
      <div
        className={`w-full flex items-center gap-1 ${compact ? 'h-11 px-1 xl:h-6 xl:px-0.5 xl:rounded-md' : 'h-11 px-1 rounded-2xl'} border bg-white/10 text-white text-[18px] leading-none transition-all ${
          isOpen
            ? 'border-white ring-2 ring-white/30'
            : 'border-white/30 hover:border-white/60'
        }`}
      >
        {/* PREVIOUS BOOK - Always visible, disabled if no prev book */}
        <button
          type="button"
          disabled={!prevBook}
          onClick={() => prevBook && onSelectBook(prevBook, 1)}
          className="h-full px-1.5 flex items-center rounded text-white/80 hover:text-white hover:bg-white/15 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={prevBook ? `Livre précédent: ${prevBook.name}` : 'Aucun livre précédent'}
          aria-label="Livre précédent"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="h-full flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
        >
          {selectedBook ? (
            <span className="font-semibold truncate">{selectedBook.name}</span>
          ) : (
            <span className="text-white/70 truncate">
              Choisir un livre...
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-white/80 transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`} />
        </button>

        {/* NEXT BOOK - Always visible, disabled if no next book */}
        <button
          type="button"
          disabled={!nextBook}
          onClick={() => nextBook && onSelectBook(nextBook, 1)}
          className="h-full px-1.5 flex items-center rounded text-white/80 hover:text-white hover:bg-white/15 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={nextBook ? `Livre suivant: ${nextBook.name}` : 'Aucun livre suivant'}
          aria-label="Livre suivant"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-full min-w-[min(40rem,calc(100vw-2rem))] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[70vh] overflow-y-auto p-3">
            {testamentColumns.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {testamentColumns.map((column, columnIndex) => (
                  <div key={columnIndex} className="min-w-0">
                    <div className="sticky top-0 z-10 mb-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-500/30 rounded-md">
                      {column.testamentName}
                    </div>
                    <div className="space-y-2">
                      {column.groups.map((group, groupIndex) => (
                        <div key={groupIndex}>
                          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <Layers className="w-3 h-3" />
                            <span className="truncate">{group.classificationName}</span>
                          </div>
                          <div className="space-y-0.5">
                            {group.books.map((book) => (
                              <div
                                key={book.code}
                                onClick={() => {
                                  onSelectBook(book, 1);
                                  setIsOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2 py-1 text-sm rounded-md hover:bg-muted/50 transition-colors cursor-pointer ${
                                  selectedBook?.code === book.code ? 'bg-amber-500/15' : ''
                                }`}
                              >
                                <span className="w-8 h-6 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                                  {book.code}
                                </span>
                                <span className="font-semibold truncate">{book.name}</span>
                              </div>
                            ))}
                          </div>
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
        </div>
      )}
    </div>
  );
};
