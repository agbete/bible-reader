import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/bible/Navbar';
import { SearchDialog } from '@/components/bible/SearchDialog';
import { BookmarksDrawer } from '@/components/bible/BookmarksDrawer';
import { DbStatusModal } from '@/components/bible/DbStatusModal';
import { ReaderDialog } from '@/components/bible/ReaderDialog';
import { 
  getDbLanguages, 
  getDbBibleVersions, 
  getDbAllBooks, 
  getDbStats,
  getDbChapterVerses,
  DbLanguage, 
  DbBibleVersion, 
  DbBookItem,
  DbStats
} from '@/services/bibleDb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; 
import { 
  Globe, 
  BookMarked, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  BookOpen, 
  Layers, 
  Check, 
  Loader2,
  Database,
  Scroll,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';

export const BiblePage: React.FC = () => {
  // DB states
  const [languages, setLanguages] = useState<DbLanguage[]>([]);
  const [versions, setVersions] = useState<DbBibleVersion[]>([]);
  const [booksList, setBooksList] = useState<DbBookItem[]>([]);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [selectedLanguageId, setSelectedLanguageId] = useState<number | 'ALL'>('ALL');
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('LSG');
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL');
  const [searchBook, setSearchBook] = useState('');

  // --- NEW STATE: Chapter and Version Selection ---
  const [selectedBook, setSelectedBook] = useState<DbBookItem | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]); // Will be set after loading
  
  // Reader state
  const [readerState, setReaderState] = useState<{
    isOpen: boolean;
    bookCode: string;
    bookName: string;
    chapterNumber: number;
    totalChapters: number;
  }>({
    isOpen: false,
    bookCode: 'GEN',
    bookName: 'Genèse',
    chapterNumber: 1,
    totalChapters: 50
  });

  // Verses data for display
  const [versesData, setVersesData] = useState<Record<string, any[]>>({}); // versionCode => verses array
  const [versesLoading, setVersesLoading] = useState<Record<string, boolean>>({}); // versionCode => loading state

  // Modal states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  // Hook for toast
  const { toast } = useToast();

  // 1. Initialisation depuis Supabase
  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      setLoading(true);
      setLoadError(null);
      try {
        console.log('[BiblePage] Starting data load...');
        
        const [langs, vers, books, dbStats] = await Promise.all([
          getDbLanguages(),
          getDbBibleVersions(),
          getDbAllBooks(),
          getDbStats()
        ]);

        if (!mounted) return;

        console.log('[BiblePage] Data loaded:', { 
          langs: langs.length, 
          vers: vers.length, 
          books: books.length, 
          stats: dbStats 
        });

        setLanguages(langs);
        setVersions(vers);
        setBooksList(books);
        setStats(dbStats);

        // Set available versions for comparison
        if (vers && vers.length > 0) {
          const versionCodes = vers.map(v => v.code);
          // Default to first version if LSG not available
          const defaultVersion = versionCodes.includes('LSG') ? 'LSG' : versionCodes[0];
          // Initialize selected versions with default
          setSelectedVersions([defaultVersion]);
          // Also set the selectedVersionCode to match
          setSelectedVersionCode(defaultVersion);
        } else {
          console.warn('[BiblePage] No versions found in database');
          setSelectedVersions(['LSG']);
          setSelectedVersionCode('LSG');
        }

        if (books && books.length > 0) {
          // Set default book to first one
          setSelectedBook(books[0]);
          setSelectedChapter(1);
          
          // Load verses for the default book/chapter/version
          await loadVersesForSelectedBook();
        }
      } catch (err) {
        console.error('[BiblePage] Erreur lors du chargement des données Supabase:', err);
        if (mounted) {
          setLoadError("Impossible de charger les données de la base de données. Vérifiez votre connexion Supabase.");
          showError("Erreur de chargement des données bibliques");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Recharge les traductions des livres si la langue change
  useEffect(() => {
    if (!loading) {
      console.log('[BiblePage] Language changed, reloading books:', selectedLanguageId);
      getDbAllBooks(selectedLanguageId === 'ALL' ? undefined : selectedLanguageId)
        .then(books => {
          if (books.length > 0) {
            setBooksList(books);
            console.log('[BiblePage] Books reloaded for language:', books.length);
          }
        })
        .catch(err => {
          console.error('[BiblePage] Error reloading books:', err);
        });
    }
  }, [selectedLanguageId, loading]);

  // Load verses when book, chapter, or versions change
  useEffect(() => {
    if (selectedBook && !loading) {
      loadVersesForSelectedBook();
    }
  }, [selectedBook, selectedChapter, selectedVersions, loading]);

  // Filtrage des versions par langue
  const filteredVersions = versions.filter(v => {
    if (selectedLanguageId === 'ALL') return true;
    return v.language_id === selectedLanguageId;
  });

  // Version active
  const activeVersion = versions.find(v => v.code === selectedVersionCode) || versions[0] || {
    id: 1,
    code: selectedVersionCode || 'LSG',
    name: 'Version de la Bible',
    short_name: selectedVersionCode,
    language_id: 1,
    is_default: true
  };

  // Filtrage des livres
  const filteredBooks = booksList.filter(book => {
    const isOT = book.testament_id === 1 || book.testament_code === 'OT' || book.testament_code === 'AT';
    const isNT = book.testament_id === 2 || book.testament_code === 'NT';

    let matchesTestament = true;
    if (testamentFilter === 'OT') matchesTestament = isOT;
    if (testamentFilter === 'NT') matchesTestament = isNT;

    const matchesSearch = 
      book.name.toLowerCase().includes(searchBook.toLowerCase()) || 
      book.code.toLowerCase().includes(searchBook.toLowerCase());

    return matchesTestament && matchesSearch;
  });

  // Load verses for the currently selected book/chapter/versions
  const loadVersesForSelectedBook = async () => {
    if (!selectedBook) return;
    
    // Reset verses data
    setVersesData(prev => {
      const newData = {};
      selectedVersions.forEach(version => {
        newData[version] = [];
      });
      return newData;
    });
    
    // Set loading state for each version
    setVersesLoading(prev => {
      const newState = {};
      selectedVersions.forEach(version => {
        newState[version] = true;
      });
      return newState;
    });
    
    try {
      // Fetch verses for each selected version
      const versesPromises = selectedVersions.map(async (versionCode) => {
        try {
          const verses = await getDbChapterVerses(
            selectedBook.id, 
            selectedChapter, 
            versionCode
          );
          return { versionCode, verses };
        } catch (error) {
          console.error(`[BiblePage] Error loading verses for ${versionCode}:`, error);
          return { versionCode, verses: [] };
        }
      });
      
      const results = await Promise.all(versesPromises);
      
      // Update verses data
      setVersesData(prev => {
        const newData = { ...prev };
        results.forEach(({ versionCode, verses }) => {
          newData[versionCode] = verses;
        });
        return newData;
      });
    } catch (error) {
      console.error('[BiblePage] Error in loadVersesForSelectedBook:', error);
    } finally {
      // Set loading state to false for each version
      setVersesLoading(prev => {
        const newState = { ...prev };
        selectedVersions.forEach(version => {
          newState[version] = false;
        });
        return newState;
      });
    }
  };

  const handleOpenReader = (book: DbBookItem, chapter: number = 1) => {
    console.log('[BiblePage] Opening reader:', book.code, chapter);
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setSelectedVersions([activeVersion.code]); // Reset to default version
    setSelectedVersionCode(activeVersion.code);
    
    setReaderState({
      isOpen: true,
      bookCode: book.code,
      bookName: book.name,
      chapterNumber: chapter,
      totalChapters: book.chapters_count || 1
    });
    
    // Load verses for the new selection
    loadVersesForSelectedBook();
  };

  const handleRetryLoad = () => {
    setLoading(true);
    setLoadError(null);
    window.location.reload();
  };

  const handleChapterChange = (newChapter: number) => {
    if (!selectedBook) return;
    
    const maxChapters = selectedBook.chapters_count || 1;
    const clampedChapter = Math.max(1, Math.min(newChapter, maxChapters));
    
    setSelectedChapter(clampedChapter);
    setReaderState(prev => ({
      ...prev,
      chapterNumber: clampedChapter
    }));
    
    // Load verses for the new chapter
    loadVersesForSelectedBook();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-amber-500/20 selection:text-amber-800">
      {/* Top Navbar */}
      <Navbar
        currentVersion={selectedVersionCode}
        onVersionChange={setSelectedVersionCode}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
      />

      {/* --- HORIZONTAL VERSIONS BAR & LANGUAGE FILTER --- */}
      <section className="border-b border-border/80 bg-card/70 backdrop-blur-md sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Langue Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <div className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 mr-1 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5" />
                <span>Langues ({languages.length}) :</span>
              </div>

              <button
                onClick={() => setSelectedLanguageId('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 ${
                  selectedLanguageId === 'ALL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Toutes les langues
              </button>

              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setSelectedLanguageId(lang.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 ${
                    selectedLanguageId === lang.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {lang.name} ({lang.code})
                </button>
              ))}
            </div>

            {/* Current Active Version Info Badge */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Version active :</span>
              <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 font-bold border border-amber-500/30 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-amber-600" />
                {activeVersion.name} ({activeVersion.code})
              </span>
            </div>

            {/* Horizontal List of Version Codes - Comparison Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-600" /> 
                Versions ({filteredVersions.length}) :
              </span>

              {filteredVersions.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  Aucune version enregistrée pour cette langue.
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  {/* Default version badge */}
                  <div className="relative">
                    <span 
                      onClick={() => { 
                        setSelectedVersions(['LSG']); 
                        setSelectedVersionCode('LSG');
                        toast({ title: 'Version réinitialisée à LSG' });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all shrink-0 border ${
                        selectedVersions.length === 1 && selectedVersions[0] === 'LSG'
                          ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-600 shadow-sm'
                          : 'bg-card text-foreground border-border hover:border-amber-500/60'
                      }`}
                      title="Version par défaut"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Défaut</span>
                    </span>
                  </div>

                  {/* Version selection pills */}
                  {filteredVersions.map((ver) => {
                    const isSelected = selectedVersions.includes(ver.code);
                    // Determine the action based on current state
                    const onClickHandler = () => {
                      if (isSelected) {
                        // Deselect this version
                        setSelectedVersions(prev => prev.filter(v => v !== ver.code));
                        // If we just removed the last version, select the first available one
                        if (selectedVersions.filter(v => v === ver.code).length === 0 && selectedVersions.length === 0) {
                          const firstAvailable = filteredVersions.find(v => !selectedVersions.includes(v.code)) || filteredVersions[0];
                          setSelectedVersions([firstAvailable.code]);
                          setSelectedVersionCode(firstAvailable.code);
                        } else if (selectedVersions.filter(v => v === ver.code).length === 0) {
                          // Update version code to the first remaining version
                          setSelectedVersionCode(selectedVersions[0]);
                        }
                      } else if (selectedVersions.length < 4) {
                        // Select this version
                        setSelectedVersions(prev => [...prev, ver.code]);
                        setSelectedVersionCode(ver.code);
                      }
                    };
                    
                    return (
                      <button
                        key={ver.id || ver.code}
                        onClick={onClickHandler}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all shrink-0 ${
                          isSelected 
                            ? 'bg-amber-600 text-white border-amber-600' 
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-200 border border-amber-200/60 hover:bg-amber-50/80 hover:border-amber-500/60 dark:hover:bg-amber-950/40'
                        }`}
                        title={isSelected ? 'Désélectionner' : 'Sélectionner pour comparaison'}
                      >
                        {ver.code}
                        {ver.short_name && ver.short_name !== ver.code && (
                          <span className={`text-[10px] font-normal opacity-80 ml-1`}>
                            • {ver.short_name}
                          </span>
                        )}
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    );
                  })}
                  
                  {/* Action button to select all */}
                  {selectedVersions.length < filteredVersions.length && (
                    <button
                      onClick={() => {
                        const allCodes = filteredVersions.map(v => v.code);
                        setSelectedVersions(allCodes);
                        setSelectedVersionCode(allCodes[0]); // Set to first version
                        toast({ title: `${allCodes.length} versions sélectionnées` });
                      }}
                      className="px-2.5 py-1 rounded-full text-[10px] text-amber-600 dark:text-amber-400 hover:bg-amber-50/20 transition-colors"
                    >
                      +{filteredVersions.length - selectedVersions.length} autres
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Bible Explorer Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Banner */}
        {loadError && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{loadError}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetryLoad}
              className="h-8 px-3 text-xs gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réessayer
            </Button>
          </div>
        )}

        {/* Chapter Selector Section */}
        <section className="p-4 rounded-2xl bg-card border border-border mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Book Selector */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un livre (ex: Jean, Psaumes, Romains...)"
                value={selectedBook?.name || ''}
                onChange={(e) => {
                  const query = e.target.value.trim();
                  if (query) {
                    const matched = booksList.find(b => 
                      b.name.toLowerCase().includes(query) || 
                      b.code.toLowerCase().includes(query)
                    );
                    if (matched) {
                      handleOpenReader(matched, 1);
                    }
                  }
                }}
                className="pl-10 h-11 rounded-2xl bg-card border-border text-sm"
                disabled={!selectedBook}
                placeholder={selectedBook ? `Lire ${selectedBook.name} chapitre...` : 'Rechercher un livre...'}
              />
            </div>

            {/* Chapter Selector */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleChapterChange(1)}
                className="h-9 px-3 rounded-full text-xs gap-1"
                disabled={!selectedBook}
              >
                <ChevronLeft className="w-4 h-4" />
                Debut
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Chapitre {selectedChapter}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  / {selectedBook?.chapters_count}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleChapterChange(selectedChapter + 1)}
                className="h-9 px-3 rounded-full text-xs gap-1"
                disabled={!selectedBook || selectedChapter >= (selectedBook?.chapters_count || 1)}
              >
                Fin
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Verses Display Section */}
        {selectedBook && !loading ? (
          <section className="p-4 rounded-2xl bg-card border border-border">
            {/* Verses Grid based on selected versions */}
            <div className="space-y-4">
              {selectedVersions.length > 0 && selectedBook ? (
                <div className={`grid gap-4 ${
                  selectedVersions.length === 1 ? 'grid-cols-1' :
                  selectedVersions.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  selectedVersions.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }`}>
                  {selectedVersions.map((versionCode, versionIndex) => {
                    // Find the version object for display name
                    const versionObj = versions.find(v => v.code === versionCode) || { name: versionCode, code: versionCode };
                    
                    // Get verses for this version
                    const verses = versesData[versionCode] || [];
                    const isLoading = versesLoading[versionCode] || false;
                    
                    return (
                      <div key={versionCode} className="p-4 rounded-2xl border border-border bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                            {versionObj.name} ({versionCode})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {verses.length} versets
                          </span>
                        </div>
                        
                        {isLoading ? (
                          <div className="py-8 text-center text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                            <span>Chargement en cours...</span>
                          </div>
                        ) : verses.length === 0 ? (
                          <div className="py-8 text-center text-muted-foreground">
                            <span>Aucun verset trouvé pour ce chapitre dans cette version.</span>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm font-serif leading-relaxed">
                            {verses.map((v, i) => (
                              <div key={v.id} className="p-2 rounded border border-border/20 hover:bg-muted/50 transition-colors">
                                <span className="font-semibold text-amber-600 text-[11px] mr-2">
                                  {v.verse_number}
                                </span>
                                <p className="whitespace-pre-wrap text-foreground">
                                  {v.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                  <span>Sélectionnez au moins une version pour afficher les versets</span>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* Reader Dialog */}
        <ReaderDialog
          isOpen={readerState.isOpen}
          onClose={() => setReaderState(prev => ({ ...prev, isOpen: false }))}
          bookId={readerState.bookCode}
          chapterNumber={readerState.chapterNumber}
          currentVersion={selectedVersionCode}
          selectedVersions={selectedVersions}
          onChapterChange={(bookId, chapter) => {
            setReaderState(prev => ({ ...prev, bookCode: bookId, chapterNumber: chapter }));
            // Update selected book and chapter in main state when opening from reader
            const matchedBook = booksList.find(b => b.code === bookId);
            if (matchedBook) {
              setSelectedBook(matchedBook);
              setSelectedChapter(chapter);
              loadVersesForSelectedBook();
            }
          }}
          isBookmarked={(id) => bookmarks.some(b => b.id === id)}
          onToggleBookmark={(verse) => {
            if (bookmarks.some(b => b.id === verse.id)) {
              setBookmarks(prev => prev.filter(b => b.id !== verse.id));
              toast({ title: "Verset retiré des favoris." });
            } else {
              setBookmarks(prev => [...prev, verse]);
              toast({ title: "Verset ajouté aux favoris !" });
            }
          }}
        />

        {/* Search Dialog */}
        <SearchDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectBookChapter={(bookId, chapter) => {
            const matched = booksList.find(b => b.code.toLowerCase() === bookId.toLowerCase());
            setReaderState({
              isOpen: true,
              bookCode: matched?.code || bookId,
              bookName: matched?.name || bookId,
              chapterNumber: chapter,
              totalChapters: matched?.chapters_count || 1
            });
            
            // Also update main state
            if (matched) {
              setSelectedBook(matched);
              setSelectedChapter(chapter);
              setSelectedVersions([activeVersion.code]); // Reset to default version
              setSelectedVersionCode(activeVersion.code);
              loadVersesForSelectedBook();
            }
          }}
        />

        {/* Bookmarks Drawer */}
        <BookmarksDrawer
          isOpen={isBookmarksOpen}
          onClose={() => setIsBookmarksOpen(false)}
          bookmarks={bookmarks}
          onRemoveBookmark={(id) => setBookmarks(prev => prev.filter(b => b.id !== id))}
          onOpenVerseChapter={(bookId, chapter) => {
            setReaderState({
              isOpen: true,
              bookCode: bookId,
              bookName: bookId,
              chapterNumber: chapter,
              totalChapters: 50
            });
            
            // Also update main state
            const matchedBook = booksList.find(b => b.code === bookId);
            if (matchedBook) {
              setSelectedBook(matchedBook);
              setSelectedChapter(chapter);
              setSelectedVersions([activeVersion.code]); // Reset to default version
              setSelectedVersionCode(activeVersion.code);
              loadVersesForSelectedBook();
            }
          }}
        />

        {/* Database Diagnostic Modal */}
        <DbStatusModal
          isOpen={isDbStatusOpen}
          onClose={() => setIsDbStatusOpen(false)}
        />

        {/* Footer */}
        <footer className="border-t border-border/80 bg-muted/20 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-foreground">Parole Vivante — Page Bible</span>
            </div>
            <p className="text-center sm:text-right">
              « Toute Écriture est inspirée de Dieu, et utile pour enseigner... » — 2 Timothée 3:16
            </p>
          </div>
          <MadeWithDyad />
        </footer>
      </main>
    </div>
  );
};

export default BiblePage;