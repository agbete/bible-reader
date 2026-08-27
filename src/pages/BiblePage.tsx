import React, { useState, useEffect } from 'react';
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
  getDbVerseTitles,
  debugTitleTranslations,
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
  RefreshCw,
  BookMarked,
  List,
  LayoutGrid
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

interface TitleTranslation {
  id?: number;
  verse_id: number;
  language_id: number;
  titles: Record<string, string>;
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
  
  // UI state for title display and view mode
  const [showTitles, setShowTitles] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<'compact' | 'list'>('compact');
  const [titleTranslations, setTitleTranslations] = useState<Record<number, TitleTranslation>>({});

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  const [testamentNames, setTestamentNames] = useState<Map<number, string>>(new Map());
  const [classificationNames, setClassificationNames] = useState<Map<number, string>>(new Map());

  const { toast } = useToast();

  // NOUVEAU: Calculer le languageId directement depuis la version sélectionnée
  // Cela évite le mapping par code qui ne marche pas avec title_translations
  const targetLanguageId = React.useMemo(() => {
    if (selectedVersions.length === 0) return 3; // French par défaut
    const ver = versions.find(v => v.code === selectedVersions[0]);
    if (!ver) return 3;
    return ver.language_id ?? 3;
  }, [selectedVersions, versions]);

  // Ancien targetLanguageCode gardé si besoin ailleurs
  const targetLanguageCode = React.useMemo(() => {
    if (selectedVersions.length === 0) return 'fr';
    const ver = versions.find(v => v.code === selectedVersions[0]);
    if (!ver) return 'fr';
    const lang = languages.find(l => l.id === ver.language_id);
    return lang?.code || 'fr';
  }, [selectedVersions, versions, languages]);

  // Diagnostic automatique au chargement
  useEffect(() => {
    debugTitleTranslations();
  }, []);

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
        console.log('[BiblePage] Starting initial data load...');
        
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
          .eq('language_id', targetLanguageId);

        const classTransMap = new Map<number, string>();
        classTransData?.forEach(c => classTransMap.set(c.classification_id, c.name));

        setLanguages(langs);
        setVersions(vers);
        setBooksList(books);
        setStats(dbStats);
        setTestamentsList(testaments);
        setClassificationsList(classifications);

        const versionCodes = vers.map(v => v.code);
        const defaultVersion = versionCodes.includes('LSG') ? 'LSG' : (versionCodes[0] || 'LSG');
        setSelectedVersions([defaultVersion]);
        setSelectedVersionCode(defaultVersion);

        if (books && books.length > 0) {
          const firstBook = books[0];
          setSelectedBook(firstBook);
          setSelectedChapter(1);
          await loadVersesForSelectedBook(firstBook, 1, [defaultVersion]);
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
    if (selectedBook && !loading && selectedVersions.length > 0) {
      loadVersesForSelectedBook(selectedBook, selectedChapter, selectedVersions);
    }
  }, [selectedBook, selectedChapter, selectedVersions]);

  // Load title translations for the current verses - UTILISER languageId DIRECT
  const loadTitleTranslationsForVerses = async (verseIds: number[]) => {
    if (!verseIds || verseIds.length === 0) {
      console.warn('[BiblePage] loadTitleTranslationsForVerses: empty verseIds list');
      return;
    }
    try {
      console.log('[BiblePage] Loading titles for', verseIds.length, 'verses. LanguageId:', targetLanguageId);
      console.log('[BiblePage] First 5 verse IDs:', verseIds.slice(0, 5));
      
      // Passer languageId DIRECT au lieu de languageCode
      const titlesMap = await getDbVerseTitles(verseIds, targetLanguageId);
      
      console.log('[BiblePage] Raw titlesMap from getDbVerseTitles:', titlesMap);
      console.log('[BiblePage] Number of verses with titles:', Object.keys(titlesMap).length);
      
      const formatted: Record<number, TitleTranslation> = {};
      Object.entries(titlesMap).forEach(([vId, titlesObj]) => {
        formatted[Number(vId)] = {
          verse_id: Number(vId),
          language_id: 0, // Non utilisé pour l'affichage
          titles: titlesObj
        };
      });

      console.log('[BiblePage] Titles successfully assigned to state:', Object.keys(formatted).length);
      console.log('[BiblePage] Formatted state keys:', Object.keys(formatted));
      
      setTitleTranslations(formatted);
    } catch (err) {
      console.error('[BiblePage] Exception in loadTitleTranslationsForVerses:', err);
    }
  };

  // Recharger les titres quand la version change (via changement de languageId)
  useEffect(() => {
    if (versesData && Object.keys(versesData).length > 0) {
      const firstVersion = Object.keys(versesData)[0];
      const verses = versesData[firstVersion];
      if (verses && verses.length > 0) {
        const allVerseIds = verses.map(v => v.id).filter(Boolean);
        console.log('[BiblePage] Version changed, reloading titles for', allVerseIds.length, 'verses with languageId:', targetLanguageId);
        loadTitleTranslationsForVerses(allVerseIds);
      }
    }
  }, [targetLanguageId, versesData]);

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
    
    console.log('[BiblePage] Loading verses for book:', book.code, 'chapter:', chapter, 'versions:', versionCodes);
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
      
      // Update state with loaded verses
      const updatedMap: Record<string, any[]> = {};
      results.forEach(({ code, verses }) => {
        updatedMap[code] = verses;
      });
      setVersesData(updatedMap);

      // Directly extract verse IDs from the query results for title loading
      const firstValidResult = results.find(r => r.verses && r.verses.length > 0);
      const allVerseIds = firstValidResult ? firstValidResult.verses.map(v => v.id).filter(Boolean) : [];

      console.log('[BiblePage] Extracted verse IDs for title lookup:', allVerseIds.length);
      if (allVerseIds.length > 0) {
        await loadTitleTranslationsForVerses(allVerseIds);
      } else {
        setTitleTranslations({});
      }
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
    toast({ title: `${allCodes.length} versions sélectionnées` });
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
    toast({ title: 'Version réinitialisée à LSG' });
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
      toast({ title: "Verset retiré des favoris." });
    } else {
      setBookmarks(prev => [...prev, verse]);
      toast({ title: "Verset ajouté aux favoris !" });
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
          title={isSelected ? 'Désélectionner' : 'Sélectionner pour comparaison'}
        >
          {ver.code}
        </button>
      );
    });
  };

  // Render title header for a verse
  const renderVerseTitles = (verseId: number) => {
    if (!showTitles) return null;
    const titleData = titleTranslations[verseId];
    if (!titleData || !titleData.titles) return null;

    // Trier les niveaux par ordre croissant
    const entries = Object.entries(titleData.titles)
      .filter(([_, text]) => Boolean(text && String(text).trim()))
      .sort(([a], [b]) => Number(a) - Number(b));
    
    if (entries.length === 0) return null;

    return (
      <div className="w-full my-3 space-y-1.5 border-b border-amber-500/20 pb-2">
        {entries.map(([level, text]) => {
          const lvl = parseInt(level, 10);
          if (lvl === 1) {
            return (
              <h3 key={level} className="text-base sm:text-lg font-bold font-serif text-amber-900 dark:text-amber-200 pt-2 tracking-tight">
                {text}
              </h3>
            );
          } else if (lvl === 2) {
            return (
              <h4 key={level} className="text-sm sm:text-base font-semibold font-serif text-amber-800 dark:text-amber-300 pt-1">
                {text}
              </h4>
            );
          } else {
            return (
              <h5 key={level} className="text-xs sm:text-sm font-medium italic text-muted-foreground pt-0.5">
                {text}
              </h5>
            );
          }
        })}
      </div>
    );
  };

  // Fonction de diagnostic pour tester le rendu des titres
  const debugTitles = () => {
    const verses = versesData[selectedVersionCode] || [];
    console.group('🔍 [BiblePage] TITLES DIAGNOSTIC');
    console.log('Show titles:', showTitles);
    console.log('Number of verses:', verses.length);
    console.log('Title translations in state:', Object.keys(titleTranslations).length);
    console.log('Title translations:', titleTranslations);
    
    if (verses.length > 0) {
      const firstVerse = verses[0];
      console.log('First verse:', firstVerse);
      console.log('First verse ID:', firstVerse.id);
      console.log('Titles for first verse:', titleTranslations[firstVerse.id]);
      
      // Compter combien de versets ont des titres
      const versesWithTitles = verses.filter(v => titleTranslations[v.id] && Object.keys(titleTranslations[v.id].titles).length > 0);
      console.log('Verses with titles:', versesWithTitles.length, '/', verses.length);
    }
    console.groupEnd();
  };

  // Exécuter le diagnostic après chaque mise à jour des titres
  useEffect(() => {
    if (Object.keys(titleTranslations).length > 0) {
      debugTitles();
    }
  }, [titleTranslations]);

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
            <div key={versionCode} className="p-4 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {versionObj.name} ({versionCode})
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {verses.length} versets
                </span>
              </div>
              
              {isLoadingV ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
                  <span className="text-xs font-medium">Chargement des versets...</span>
                </div>
              ) : verses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <span className="text-xs">Aucun verset trouvé pour ce chapitre dans cette version.</span>
                </div>
              ) : displayMode === 'list' ? (
                /* === MODE LISTE : Verset par verset sur sa propre ligne === */
                <div className="space-y-3 font-serif text-sm sm:text-base leading-relaxed">
                  {verses.map((verse) => (
                    <div key={verse.id || verse.verse_number} className="group">
                      {renderVerseTitles(verse.id)}
                      <div className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-muted/40 transition-colors">
                        <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 select-none pt-1 shrink-0 min-w-[1.75rem]">
                          {verse.verse_number}.
                        </span>
                        <p className="text-foreground flex-1">
                          {verse.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* === MODE COMPACT : Versets en continu dans un flux de paragraphe === */
                <div className="font-serif text-sm sm:text-base leading-relaxed text-foreground">
                  {verses.map((verse) => {
                    const titlesHeader = renderVerseTitles(verse.id);
                    return (
                      <React.Fragment key={verse.id || verse.verse_number}>
                        {titlesHeader}
                        <span className="inline hover:bg-amber-500/10 rounded px-0.5 transition-colors">
                          <sup className="font-sans font-bold text-xs text-amber-600 dark:text-amber-400 font-mono mr-1 select-none">
                            {verse.verse_number}
                          </sup>
                          <span>{verse.text} </span>
                        </span>
                      </React.Fragment>
                    );
                  })}
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

      {/* Language and version selection bar */}
      <section className="border-b border-border/80 bg-amber-50 dark:bg-amber-950/20 backdrop-blur-md sticky top-16 z-30 shadow-xs mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
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

            <div className="flex items-center px-3 shrink-0" aria-hidden="true">
              <div className="w-px h-6 bg-amber-300/60 dark:bg-amber-700/60"></div>
              <span className="text-amber-400 dark:text-amber-600 font-bold text-lg mx-2 select-none">|</span>
              <div className="w-px h-6 bg-amber-300/60 dark:bg-amber-700/60"></div>
            </div>

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
              Défaut
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
              Réessayer
            </Button>
          </div>
        )}

        <section className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center">
            <div className="flex-1 min-w-0">
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

            <div className="flex items-center gap-1.5 shrink-0 border-t xl:border-t-0 xl:border-l border-border pt-2 xl:pt-0 xl:pl-3">
              <Button
                variant={showTitles ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  console.log('[BiblePage] Toggle showTitles from:', showTitles, 'to:', !showTitles);
                  console.log('[BiblePage] Current titleTranslations state:', titleTranslations);
                  setShowTitles(prev => !prev);
                  toast({
                    title: !showTitles ? "Titres de section affichés" : "Titres de section masqués"
                  });
                }}
                className={`h-9 px-3 rounded-full text-xs gap-1.5 font-medium transition-all ${
                  showTitles 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={showTitles ? "Masquer les titres de section" : "Afficher les titres de section"}
              >
                <BookMarked className={`w-3.5 h-3.5 ${showTitles ? 'fill-white' : ''}`} />
                <span>Titres</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextMode = displayMode === 'compact' ? 'list' : 'compact';
                  setDisplayMode(nextMode);
                  toast({
                    title: nextMode === 'compact' ? "Mode continu (compact) activé" : "Mode liste (ligne par ligne) activé"
                  });
                }}
                className={`h-9 px-3 rounded-full text-xs gap-1.5 font-medium transition-all ${
                  displayMode === 'list'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {displayMode === 'compact' ? (
                  <>
                    <LayoutGrid className="w-3.5 h-3.5 text-amber-600" />
                    <span>Compact</span>
                  </>
                ) : (
                  <>
                    <List className="w-3.5 h-3.5 text-amber-600" />
                    <span>Liste</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {selectedBook && !loading && (
          <section className="space-y-4">
            {selectedVersions.length > 0 ? (
              renderVersionsGrid()
            ) : (
              <div className="p-8 rounded-2xl bg-card border border-border text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-2" />
                <span className="text-xs">Sélectionnez au moins une version pour afficher les versets</span>
              </div>
            )}
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
              <span className="font-semibold text-foreground">Parole Vivante — Application Sainte Bible</span>
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