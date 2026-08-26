import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/bible/Navbar';
import { SearchDialog } from '@/components/bible/SearchDialog';
import { BookmarksDrawer } from '@/components/bible/BookmarksDrawer';
import { DbStatusModal } from '@/components/bible/DbStatusModal';
import { ReaderDialog } from '@/components/bible/ReaderDialog';
import { BookSearchSelect } from '@/components/bible/BookSearchSelect';
import { ChapterNavigator } from '@/components/bible/ChapterNavigator';
import { 
  getDbLanguages, 
  getDbAllBooks, 
  getDbStats,
  getDbChapterVerses,
  getDbVersionsWithVerses,
  DbLanguage, 
  DbBibleVersion, 
  DbBookItem,
  DbStats
} from '@/services/bibleDb';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Globe,
  BookOpen, 
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';

interface DbTestament {
  id: number;
  code: string;
  name: string;
}

interface DbClassification {
  id: number;
  code?: string;
  name: string;
  testament_id: number;
}

export const BiblePage: React.FC = () => {
  const [languages, setLanguages] = useState<DbLanguage[]>([]);
  const [versions, setVersions] = useState<DbBibleVersion[]>([]);
  const [booksList, setBooksList] = useState<DbBookItem[]>([]);
  const [testamentsList, setTestamentsList] = useState<DbTestament[]>([]);
  const [classificationsList, setClassificationsList] = useState<DbClassification[]>([]);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedLanguageId, setSelectedLanguageId] = useState<number | 'ALL'>('ALL');
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('LSG');
  
  const [selectedBook, setSelectedBook] = useState<DbBookItem | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  
  const [readerState, setReaderState] = useState({
    isOpen: false,
    bookCode: 'GEN',
    bookName: 'Genèse',
    chapterNumber: 1,
    totalChapters: 50
  });

  const [versesData, setVersesData] = useState<Record<string, any[]>>({});
  const [versesLoading, setVersesLoading] = useState<Record<string, boolean>>({});

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  const [testamentNames, setTestamentNames] = useState<Map<number, string>>(new Map());
  const [classificationNames, setClassificationNames] = useState<Map<number, string>>(new Map());

  const { toast } = useToast();

  const targetLanguageId = React.useMemo(() => {
    if (selectedVersions.length === 1) {
      const ver = versions.find(v => v.code === selectedVersions[0]);
      return ver?.language_id ?? 2;
    }
    return 2;
  }, [selectedVersions, versions]);

  useEffect(() => {
    let mounted = true;
    async function loadGroupingTranslations() {
      try {
        const { data: testData } = await supabase
          .from('testament_translations')
          .select('testament_id, name')
          .eq('language_id', targetLanguageId);

        if (mounted && testData) {
          const map = new Map<number, string>();
          testData.forEach(t => map.set(t.testament_id, t.name));
          setTestamentNames(map);
        }

        const { data: classData } = await supabase
          .from('classification_translations')
          .select('classification_id, name')
          .eq('language_id', targetLanguageId);

        if (mounted && classData) {
          const map = new Map<number, string>();
          classData.forEach(c => map.set(c.classification_id, c.name));
          setClassificationNames(map);
        }
      } catch (err) {
        console.error('[BiblePage] Error loading grouping translations:', err);
      }
    }

    if (targetLanguageId !== undefined) {
      loadGroupingTranslations();
    }
  }, [targetLanguageId]);

  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      setLoading(true);
      setLoadError(null);
      try {
        console.log('[BiblePage] Starting data load...');
        
        const [langs, vers, books, dbStats, testamentsRes, classificationsRes] = await Promise.all([
          getDbLanguages(),
          getDbVersionsWithVerses(),
          getDbAllBooks(),
          getDbStats(),
          supabase.from('testaments').select('id, code, order_index'),
          supabase.from('classifications').select('id, code, testament_id, order_index')
        ]);

        if (!mounted) return;

        const { data: testTransData } = await supabase
          .from('testament_translations')
          .select('testament_id, language_id, name')
          .eq('language_id', targetLanguageId);

        const testTransMap = new Map<number, string>();
        testTransData?.forEach(t => testTransMap.set(t.testament_id, t.name));

        const testaments: DbTestament[] = (testamentsRes.data || []).map(t => ({
          id: t.id,
          code: t.code,
          name: testTransMap.get(t.id) || (t.code === 'OT' ? 'Ancien Testament' : 'Nouveau Testament')
        }));

        const { data: classTransData } = await supabase
          .from('classification_translations')
          .select('classification_id, language_id, name')
          .eq('language_id', 2);

        const classTransMap = new Map<number, string>();
        classTransData?.forEach(c => classTransMap.set(c.classification_id, c.name));

        const classifications: DbClassification[] = (classificationsRes.data || []).map(c => ({
          id: c.id,
          code: c.code,
          name: classTransMap.get(c.id) || c.code,
          testament_id: c.testament_id
        }));

        setLanguages(langs);
        setVersions(vers);
        setBooksList(books);
        setStats(dbStats);
        setTestamentsList(testaments);
        setClassificationsList(classifications);

        if (vers && vers.length > 0) {
          const versionCodes = vers.map(v => v.code);
          const defaultVersion = versionCodes.includes('LSG') ? 'LSG' : versionCodes[0];
          setSelectedVersions([defaultVersion]);
          setSelectedVersionCode(defaultVersion);
        } else {
          setSelectedVersions(['LSG']);
          setSelectedVersionCode('LSG');
        }

        if (books && books.length > 0) {
          setSelectedBook(books[0]);
          setSelectedChapter(1);
          await loadVersesForSelectedBook(books[0], 1, [selectedVersionCode]);
        }
      } catch (err) {
        console.error('[BiblePage] Erreur lors du chargement:', err);
        if (mounted) {
          setLoadError("Impossible de charger les données de la base de données.");
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

  useEffect(() => {
    if (!loading) {
      getDbAllBooks(selectedLanguageId === 'ALL' ? undefined : selectedLanguageId)
        .then(books => {
          if (books.length > 0) {
            setBooksList(books);
          }
        })
        .catch(err => {
          console.error('[BiblePage] Error reloading books:', err);
        });
    }
  }, [selectedLanguageId, loading]);

  useEffect(() => {
    if (selectedBook && !loading) {
      loadVersesForSelectedBook(selectedBook, selectedChapter, selectedVersions);
    }
  }, [selectedBook, selectedChapter, selectedVersions, loading]);

  const filteredVersions = versions.filter(v => {
    if (selectedLanguageId === 'ALL') return true;
    return v.language_id === selectedLanguageId;
  });

  const activeVersion = versions.find(v => v.code === selectedVersionCode) || versions[0] || {
    id: 1,
    code: selectedVersionCode || 'LSG',
    name: 'Version de la Bible',
    short_name: selectedVersionCode,
    language_id: 1,
    is_default: true
  };

  const loadVersesForSelectedBook = async (book: DbBookItem, chapter: number, versionCodes: string[]) => {
    if (!book) return;
    
    const newData: Record<string, any[]> = {};
    const newLoading: Record<string, boolean> = {};
    versionCodes.forEach(v => {
      newData[v] = [];
      newLoading[v] = true;
    });
    setVersesData(newData);
    setVersesLoading(newLoading);
    
    try {
      const promises = versionCodes.map(async (code) => {
        try {
          const verses = await getDbChapterVerses(book.id, chapter, code);
          return { code, verses };
        } catch (err) {
          console.error(`[BiblePage] Error loading verses for ${code}:`, err);
          return { code, verses: [] };
        }
      });
      
      const results = await Promise.all(promises);
      
      setVersesData(prev => {
        const updated = { ...prev };
        results.forEach(({ code, verses }) => {
          updated[code] = verses;
        });
        return updated;
      });
    } finally {
      setVersesLoading(prev => {
        const updated = { ...prev };
        versionCodes.forEach(v => {
          updated[v] = false;
        });
        return updated;
      });
    }
  };

  const handleSelectBookAndChapter = (book: DbBookItem, chapter: number) => {
    console.log('[BiblePage] Book selected:', book.code, 'chapter:', chapter);
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setSelectedVersions([activeVersion.code]);
    setSelectedVersionCode(activeVersion.code);
  };

  const handleBookChange = (book: DbBookItem) => {
    setSelectedBook(book);
    setSelectedChapter(1);
  };

  const handleChapterChange = (chapter: number) => {
    if (!selectedBook) return;
    const clamped = Math.max(1, Math.min(chapter, selectedBook.chapters_count));
    setSelectedChapter(clamped);
  };

  const handleRetryLoad = () => {
    setLoading(true);
    setLoadError(null);
    window.location.reload();
  };

  const handleSelectAllVersions = () => {
    const allCodes = filteredVersions.map(v => v.code);
    setSelectedVersions(allCodes);
    setSelectedVersionCode(allCodes[0]);
    toast({ title: `${allCodes.length} versions selectionnees` });
  };

  const handleToggleVersion = (ver: DbBibleVersion) => {
    const isSelected = selectedVersions.includes(ver.code);
    if (isSelected) {
      const next = selectedVersions.filter(v => v !== ver.code);
      if (next.length === 0) {
        setSelectedVersions([ver.code]);
        setSelectedVersionCode(ver.code);
      } else {
        setSelectedVersions(next);
        setSelectedVersionCode(next[0]);
      }
    } else if (selectedVersions.length < 4) {
      setSelectedVersions(prev => [...prev, ver.code]);
      setSelectedVersionCode(ver.code);
    }
  };

  const handleResetVersion = () => {
    setSelectedVersions(['LSG']);
    setSelectedVersionCode('LSG');
    toast({ title: 'Version reinitialisee a LSG' });
  };

  const handleSearchVersion = () => {
    setIsSearchOpen(true);
  };

  const handleOpenBookmarks = () => {
    setIsBookmarksOpen(true);
  };

  const handleOpenDbStatus = () => {
    setIsDbStatusOpen(true);
  };

  const handleReaderChapterChange = (bookId: string, chapter: number) => {
    setReaderState(prev => ({ ...prev, bookCode: bookId, chapterNumber: chapter }));
    const matchedBook = booksList.find(b => b.code === bookId);
    if (matchedBook) {
      setSelectedBook(matchedBook);
      setSelectedChapter(chapter);
    }
  };

  const handleToggleBookmark = (verse: any) => {
    if (bookmarks.some(b => b.id === verse.id)) {
      setBookmarks(prev => prev.filter(b => b.id !== verse.id));
      toast({ title: "Verset retire des favoris." });
    } else {
      setBookmarks(prev => [...prev, verse]);
      toast({ title: "Verset ajoute aux favoris !" });
    }
  };

  const renderVersionButtons = () => {
    return filteredVersions.map((ver) => {
      const isSelected = selectedVersions.includes(ver.code);
      return (
        <button
          key={ver.id || ver.code}
          onClick={() => handleToggleVersion(ver)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all shrink-0 ${
            isSelected 
              ? 'bg-amber-600 text-white border-amber-600' 
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-200 border border-amber-200/60 hover:bg-amber-50/80 hover:border-amber-500/60 dark:hover:bg-amber-950/40'
          }`}
          title={isSelected ? 'Deselectionner' : 'Selectionner pour comparaison'}
        >
          {ver.code}
        </button>
      );
    });
  };

  const renderVersionsGrid = () => {
    const colsClass = selectedVersions.length === 1 
      ? 'grid-cols-1' 
      : selectedVersions.length === 2 
        ? 'grid-cols-1 md:grid-cols-2' 
        : selectedVersions.length === 3 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

    return (
      <div className={`grid gap-4 ${colsClass}`}>
        {selectedVersions.map((versionCode) => {
          const versionObj = versions.find(v => v.code === versionCode) || { name: versionCode, code: versionCode };
          const verses = versesData[versionCode] || [];
          const isLoadingV = versesLoading[versionCode] || false;
          
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
              
              {isLoadingV ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
                  <span className="text-xs">Chargement en cours...</span>
                </div>
              ) : verses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <span className="text-xs">Aucun verset trouve pour ce chapitre dans cette version.</span>
                </div>
              ) : (
                <div className="space-y-2 text-sm font-serif leading-relaxed">
                  {verses.map((v) => (
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
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-amber-500/20 selection:text-amber-800">
      <Navbar
        currentVersion={selectedVersionCode}
        onVersionChange={setSelectedVersionCode}
        onOpenSearch={handleSearchVersion}
        onOpenBookmarks={handleOpenBookmarks}
        onOpenDbStatus={handleOpenDbStatus}
      />

      <section className="border-b border-border/80 bg-card/70 backdrop-blur-md sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {/* Language selection - KEEP THIS VISIBLE AS REQUESTED */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 mr-1 uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" />
              <span>Langues:</span>
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

            {/* Individual language buttons */}
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setSelectedLanguageId(lang.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-all shrink-0 ${
                  selectedLanguageId === lang.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-card text-foreground border-border hover:bg-amber-50/20'
                }`}
                title={lang.name}
              >
                {lang.code.toUpperCase()}
              </button>
            ))}

            {/* Version controls to the right as requested */}
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
              Versions:
            </span>

            <button
              onClick={handleResetVersion}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all shrink-0 border ${
                selectedVersions.length === 1 && selectedVersions[0] === 'LSG'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-600 shadow-sm'
                  : 'bg-card text-foreground border-border hover:border-amber-500/60'
              }`}
            >
              Defaut
            </button>

            {filteredVersions.length > 0 && (
              <div className="flex items-center gap-1.5">
                {renderVersionButtons()}
              </div>
            )}
            
            {filteredVersions.length > selectedVersions.length && (
              <button
                onClick={handleSelectAllVersions}
                className="px-2.5 py-1 rounded-full text-[10px] text-amber-600 dark:text-amber-400 hover:bg-amber-50/20 transition-colors"
              >
                +{filteredVersions.length - selectedVersions.length} autres
              </button>
            )}
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
              Reessayer
            </Button>
          </div>
        )}

        <section className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1 min-w-0 relative">
              <BookSearchSelect
                booksList={booksList}
                selectedBook={selectedBook}
                selectedChapter={selectedChapter}
                onSelectBook={handleSelectBookAndChapter}
                currentVersion={selectedVersionCode}
                isLoading={loading}
                testamentsList={testamentsList}
                classificationsList={classificationsList}
                testamentNames={testamentNames}
                classificationNames={classificationNames}
              />
            </div>

            <div className="shrink-0">
              <ChapterNavigator
                selectedBook={selectedBook}
                selectedChapter={selectedChapter}
                booksList={booksList}
                onChapterChange={handleChapterChange}
                onBookChange={handleBookChange}
              />
            </div>
          </div>
        </section>

        {selectedBook && !loading && (
          <section className="p-4 rounded-2xl bg-card border border-border">
            <div className="space-y-4">
              {selectedVersions.length > 0 ? (
                renderVersionsGrid()
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
                  <span className="text-xs">Selectionnez au moins une version pour afficher les versets</span>
                </div>
              )}
            </div>
          </section>
        )}

        <ReaderDialog
          isOpen={readerState.isOpen}
          onClose={() => setReaderState(prev => ({ ...prev, isOpen: false }))}
          bookId={readerState.bookCode}
          chapterNumber={readerState.chapterNumber}
          currentVersion={selectedVersionCode}
          selectedVersions={selectedVersions}
          onChapterChange={handleReaderChapterChange}
          isBookmarked={(id) => bookmarks.some(b => b.id === id)}
          onToggleBookmark={handleToggleBookmark}
        />

        <SearchDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectBookChapter={(bookId, chapter) => {
            const matched = booksList.find(b => b.code.toLowerCase() === bookId.toLowerCase());
            if (matched) {
              setSelectedBook(matched);
              setSelectedChapter(chapter);
              setSelectedVersions([activeVersion.code]);
              setSelectedVersionCode(activeVersion.code);
            }
          }}
        />

        <BookmarksDrawer
          isOpen={isBookmarksOpen}
          onClose={() => setIsBookmarksOpen(false)}
          bookmarks={bookmarks}
          onRemoveBookmark={(id) => setBookmarks(prev => prev.filter(b => b.id !== id))}
          onOpenVerseChapter={(bookId, chapter) => {
            const matchedBook = booksList.find(b => b.code === bookId);
            if (matchedBook) {
              setSelectedBook(matchedBook);
              setSelectedChapter(chapter);
              setSelectedVersions([activeVersion.code]);
              setSelectedVersionCode(activeVersion.code);
            }
          }}
        />

        <DbStatusModal
          isOpen={isDbStatusOpen}
          onClose={() => setIsDbStatusOpen(false)}
        />

        <footer className="border-t border-border/80 bg-muted/20 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-foreground">Parole Vivante - Page Bible</span>
            </div>
            <p className="text-center sm:text-right">
              « Toute Ecriture est inspiree de Dieu, et utile pour enseigner... » - 2 Timothee 3:16
            </p>
          </div>
          <MadeWithDyad />
        </footer>
      </main>
    </div>
  );
};

export default BiblePage;