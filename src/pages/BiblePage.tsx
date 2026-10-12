import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navbar } from '@/components/bible/Navbar';
import { SearchDialog } from '@/components/bible/SearchDialog';
import { BookmarksDrawer } from '@/components/bible/BookmarksDrawer';
import { DbStatusModal } from '@/components/bible/DbStatusModal';
import { ReaderDialog } from '@/components/bible/ReaderDialog';
import { BookSearchSelect } from '@/components/bible/BookSearchSelect';
import { ChapterNavigator } from '@/components/bible/ChapterNavigator';
import { VerseTreasuresModal } from '@/components/bible/VerseTreasuresModal';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BookOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
  BookMarked,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Menu,
  Search,
  Type,
  ALargeSmall,
  Check
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

const READER_FONTS = [
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { id: 'book-antiqua', label: 'Book Antiqua', family: '"Book Antiqua", "Palatino Linotype", Palatino, serif' },
  { id: 'calibri', label: 'Calibri', family: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  { id: 'cambria', label: 'Cambria', family: 'Cambria, Caladea, Georgia, serif' },
  { id: 'century-gothic', label: 'Century Gothic', family: '"Century Gothic", "URW Gothic", AppleGothic, sans-serif' },
  { id: 'courier', label: 'Courier New', family: '"Courier New", Courier, monospace' },
  { id: 'garamond', label: 'Garamond', family: 'Garamond, "EB Garamond", "Times New Roman", serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
  { id: 'helvetica', label: 'Helvetica', family: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'palatino', label: 'Palatino', family: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { id: 'segoe', label: 'Segoe UI', family: '"Segoe UI", system-ui, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', family: 'Tahoma, Geneva, sans-serif' },
  { id: 'times', label: 'Times New Roman', family: '"Times New Roman", Times, serif' },
  { id: 'trebuchet', label: 'Trebuchet', family: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' }
];
const READER_FONT_SIZES = [12, 14, 16, 18, 20, 22, 24];

// "FRANÇAIS" / "français" → "Français" (chaque mot commence par une majuscule)
const toProperCase = (str: string) =>
  str.toLocaleLowerCase('fr').replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase('fr'));

// Titres de section : tailles en "em", donc relatives à la taille de lecture choisie.
// Écarts définis pour un texte de 16px (+2px = 18/16 = 1.125em, -4px = 12/16 = 0.75em),
// ils grandissent ou rétrécissent proportionnellement avec le texte des versets.
const TITLE_LEVEL_STYLES: Record<number, { fontSize: string; className: string }> = {
  1: { fontSize: '1.125em', className: 'font-bold uppercase text-amber-900 dark:text-amber-200' },
  2: { fontSize: '0.75em', className: 'italic text-foreground' },
  3: { fontSize: '1.125em', className: 'font-bold text-amber-900 dark:text-amber-200' },
  4: { fontSize: '1em', className: 'font-bold text-foreground' },
  5: { fontSize: '0.75em', className: 'italic text-muted-foreground' }
};

const LANGUAGE_DISPLAY_ORDER =['FR', 'EN', 'FN', 'GO', 'YO', 'HG'];
const LANGUAGE_COLOR_CLASSES: Record<string, { cell: string; text: string }> = {
  FR: {
    cell: 'bg-[#BF8F00]/15 dark:bg-[#BF8F00]/25',
    text: 'text-[#765800] dark:text-[#E2B846]'
  },
  EN: {
    cell: 'bg-[#C42711]/10 dark:bg-[#C42711]/25',
    text: 'text-[#8E1C0D] dark:text-[#F07868]'
  },
  FN: {
    cell: 'bg-[#C00000]/10 dark:bg-[#C00000]/25',
    text: 'text-[#8C0000] dark:text-[#F06A6A]'
  },
  GO: {
    cell: 'bg-[#7030A0]/10 dark:bg-[#7030A0]/25',
    text: 'text-[#512074] dark:text-[#BE91E0]'
  },
  YO: {
    cell: 'bg-[#0070C0]/10 dark:bg-[#0070C0]/25',
    text: 'text-[#00548F] dark:text-[#73B9ED]'
  },
  HG: {
    cell: 'bg-[#548235]/10 dark:bg-[#548235]/25',
    text: 'text-[#3B5C25] dark:text-[#A8CD82]'
  }
};

export const BiblePage: React.FC = () => {
  const [languages, setLanguages] = useState<DbLanguage[]>([]);
  const [versions, setVersions] = useState<DbBibleVersion[]>([]);
  const [booksList, setBooksList] = useState<DbBookItem[]>([]);
  const [testamentsList, setTestamentsList] = useState<DbTestament[]>([]);
  const [classificationsList, setClassificationsList] = useState<DbClassification[]>([]);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedLanguageIds, setSelectedLanguageIds] = useState<number[]>([]);
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('LSG');
  
  const [selectedBook, setSelectedBook] = useState<DbBookItem | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  
  // Ref pour suivre la version active en temps réel
  const activeVersionRef = useRef<string>('LSG');
  useEffect(() => {
    activeVersionRef.current = selectedVersionCode;
    console.log('[BiblePage] activeVersionRef updated to:', selectedVersionCode, 'selectedVersions:', selectedVersions);
  }, [selectedVersionCode, selectedVersions]);
  
  // Verse Treasures Modal state
  const [selectedVerseForTreasures, setSelectedVerseForTreasures] = useState<{
    id: number;
    verse_number: number;
    reference_code: string;
    text: string;
    book: DbBookItem;
    chapter: number;
    versionCode: string;
  } | null>(null);

  const [readerState, setReaderState] = useState({
    isOpen: false,
    bookCode: 'GEN',
    bookName: 'Genèse',
    chapterNumber: 1,
    totalChapters: 50
  });

  const [versesData, setVersesData] = useState<Record<string, any[]>>({});
  const [versesLoading, setVersesLoading] = useState<Record<string, boolean>>({});
  // Livre:chapitre dont les versets sont actuellement affichés
  const [loadedChapterKey, setLoadedChapterKey] = useState<string | null>(null);
  
  const [showTitles, setShowTitles] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<'compact' | 'list'>('list');

  // Police et taille de lecture (mémorisées dans le navigateur)
  const [readerFontId, setReaderFontId] = useState<string>(() => {
    try { return localStorage.getItem('reader-font') || 'arial'; } catch { return 'arial'; }
  });
  const [readerFontSize, setReaderFontSize] = useState<number>(() => {
    try { return Number(localStorage.getItem('reader-font-size')) || 16; } catch { return 16; }
  });
  useEffect(() => {
    try {
      localStorage.setItem('reader-font', readerFontId);
      localStorage.setItem('reader-font-size', String(readerFontSize));
    } catch { /* stockage indisponible */ }
  }, [readerFontId, readerFontSize]);
  const readerTextStyle: React.CSSProperties = {
    fontFamily: (READER_FONTS.find(f => f.id === readerFontId) ?? READER_FONTS[0]).family,
    fontSize: `${readerFontSize}px`
  };
  
  const [titleTranslations, setTitleTranslations] = useState<
    Record<string, Record<number, TitleTranslation>>
  >({});

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  const [testamentNames, setTestamentNames] = useState<Map<number, string>>(new Map());
  const [classificationNames, setClassificationNames] = useState<Map<number, string>>(new Map());

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const { toast } = useToast();

  // ✅ FIX: Compute effective language_id for book loading based on selected version
    const effectiveLanguageId = useMemo(() => {
      // If specific languages are selected, use the first one for book loading
      if (selectedLanguageIds.length > 0) {
        console.log('[BiblePage] effectiveLanguageId:', selectedLanguageIds[0], '(from language filter)');
        return selectedLanguageIds[0];
      }
      // Otherwise, use the selected version's language_id
      const versionObj = versions.find(v => v.code === selectedVersionCode);
      if (versionObj) {
        console.log('[BiblePage] effectiveLanguageId:', versionObj.language_id, '(from version', selectedVersionCode, ')');
        return versionObj.language_id;
      }
      console.log('[BiblePage] effectiveLanguageId: undefined (no version found)');
      return undefined;
    }, [selectedLanguageIds, selectedVersionCode, versions]);

  const versionLanguageMap = useMemo(() => {
    const map = new Map<string, number>();
    versions.forEach(v => {
      map.set(v.code, v.language_id);
    });
    console.log('[BiblePage] versionLanguageMap:', Object.fromEntries(map));
    return map;
  }, [versions]);

  const currentVersionCode = selectedVersions.length > 0 ? selectedVersions[0] : selectedVersionCode;
  const targetLanguageId = versionLanguageMap.get(currentVersionCode);

  useEffect(() => {
    debugTitleTranslations();
  }, []);

  const updateScrollState = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      updateScrollState();
      el.addEventListener('scroll', updateScrollState, { passive: true });
      window.addEventListener('resize', updateScrollState);
      return () => {
        el.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [selectedVersions, versesData]);

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
        // ✅ IMPORTANT: Load languages FIRST to populate the cache
        console.log('[BiblePage] Loading languages...');
        const langs = await getDbLanguages();
        console.log('[BiblePage] Languages loaded:', langs);
        
        const [vers, books, dbStats, testamentsRes, classificationsRes] = await Promise.all([
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

        const versionCodes = vers.map(v => v.code);
        const defaultVersion = versionCodes.includes('LSG') ? 'LSG' : (versionCodes[0] || 'LSG');
        setSelectedVersions([defaultVersion]);
        setSelectedVersionCode(defaultVersion);
        activeVersionRef.current = defaultVersion;

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

  // ✅ FIX: Reload books when effectiveLanguageId changes (includes version changes)
  useEffect(() => {
    if (!loading) {
      console.log('[BiblePage] Reloading books with effectiveLanguageId:', effectiveLanguageId);
      getDbAllBooks(effectiveLanguageId)
        .then(books => {
          if (books.length > 0) {
            console.log('[BiblePage] Books loaded:', books.length, 'books, first book name:', books[0]?.name);
            setBooksList(books);
          }
        })
        .catch(err => {
          console.error('[BiblePage] Error reloading books:', err);
        });
    }
  }, [effectiveLanguageId, loading]);

  useEffect(() => {
    if (selectedBook && !loading && selectedVersions.length > 0) {
      loadVersesForSelectedBook(selectedBook, selectedChapter, selectedVersions);
    }
  }, [selectedBook, selectedChapter, selectedVersions]);

  const loadTitleTranslationsForVerses = async (verseIds: number[], versionCode: string) => {
    if (!verseIds || verseIds.length === 0) return;
    
    const langId = versionLanguageMap.get(versionCode);
    if (!langId) return;
    
    try {
      const titlesMap = await getDbVerseTitles(verseIds, langId);
      const formatted: Record<number, TitleTranslation> = {};
      Object.entries(titlesMap).forEach(([vId, titlesObj]) => {
        formatted[Number(vId)] = {
          verse_id: Number(vId),
          language_id: langId,
          titles: titlesObj
        };
      });

      setTitleTranslations(prev => ({
        ...prev,
        [versionCode]: formatted
      }));
    } catch (err) {
      console.error('[BiblePage] Exception in loadTitleTranslationsForVerses:', err);
    }
  };

  useEffect(() => {
    if (versesData && Object.keys(versesData).length > 0) {
      selectedVersions.forEach(versionCode => {
        const verses = versesData[versionCode];
        if (verses && verses.length > 0) {
          const allVerseIds = verses.map(v => v.id).filter(Boolean);
          loadTitleTranslationsForVerses(allVerseIds, versionCode);
        }
      });
    }
  }, [selectedVersions, versesData]);

  const filteredVersions = versions.filter(v => {
    if (selectedLanguageIds.length === 0) return true;
    return selectedLanguageIds.includes(v.language_id);
  });

  const orderedLanguages = [...languages].sort((a, b) => {
    const aIndex = LANGUAGE_DISPLAY_ORDER.indexOf(a.code.toUpperCase());
    const bIndex = LANGUAGE_DISPLAY_ORDER.indexOf(b.code.toUpperCase());
    return (aIndex === -1 ? LANGUAGE_DISPLAY_ORDER.length : aIndex)
      - (bIndex === -1 ? LANGUAGE_DISPLAY_ORDER.length : bIndex);
  });

  const languageVersionColumns = orderedLanguages.map(language => ({
    language,
    versions: versions.filter(version => version.language_id === language.id)
  }));
  const versionRowsCount = Math.max(0, ...languageVersionColumns.map(column => column.versions.length));

  const displayedLanguages = selectedLanguageIds.length === 0
    ? orderedLanguages
    : orderedLanguages.filter(l => selectedLanguageIds.includes(l.id));

  const defaultVersionCode = versions.find(version => version.is_default)?.code
    ?? versions.find(version => version.code === 'LSG')?.code
    ?? versions[0]?.code
    ?? 'LSG';

  const applyVersionSelection = (codes: string[], preferredActiveCode?: string) => {
    const nextVersions = [...new Set(codes.filter(code => versions.some(version => version.code === code)))];
    if (nextVersions.length === 0) nextVersions.push(defaultVersionCode);

    const activeCode = preferredActiveCode && nextVersions.includes(preferredActiveCode)
      ? preferredActiveCode
      : nextVersions.includes(selectedVersionCode)
        ? selectedVersionCode
        : nextVersions[0];
    setSelectedVersions(nextVersions);
    setSelectedVersionCode(activeCode);
    activeVersionRef.current = activeCode;
  };

  const handleToggleLanguageVersions = (languageId: number) => {
    const languageCodes = versions
      .filter(version => version.language_id === languageId)
      .map(version => version.code);
    if (languageCodes.length === 0) return;

    const allSelected = languageCodes.every(code => selectedVersions.includes(code));
    const nextVersions = allSelected
      ? selectedVersions.filter(code => !languageCodes.includes(code))
      : [...selectedVersions, ...languageCodes.filter(code => !selectedVersions.includes(code))];
    applyVersionSelection(nextVersions, allSelected ? undefined : languageCodes[0]);
  };

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
      
      const updatedMap: Record<string, any[]> = {};
      results.forEach(({ code, verses }) => {
        updatedMap[code] = verses;
      });
      setVersesData(updatedMap);
      setLoadedChapterKey(`${book.id}:${chapter}`);

      for (const { code, verses } of results) {
        if (verses && verses.length > 0) {
          const allVerseIds = verses.map(v => v.id).filter(Boolean);
          await loadTitleTranslationsForVerses(allVerseIds, code);
        }
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
    setSelectedBook(book);
    setSelectedChapter(chapter);
  };

  const handleBookChange = (book: DbBookItem) => {
    setSelectedBook(book);
    setSelectedChapter(1);
  };

  // Navigation par titre : change de chapitre puis défile jusqu'au verset
  const [pendingScrollVerse, setPendingScrollVerse] = useState<{ chapterKey: string; verse: number; verseId: number } | null>(null);

  const handleSelectTitle = (chapter: number, verseNumber: number, verseId: number) => {
    if (!selectedBook) return;
    setSelectedChapter(chapter);
    setPendingScrollVerse({ chapterKey: `${selectedBook.id}:${chapter}`, verse: verseNumber, verseId });
  };

  useEffect(() => {
    // On attend que les versets du chapitre visé soient affichés
    if (!pendingScrollVerse || loadedChapterKey !== pendingScrollVerse.chapterKey) return;
    // Le titre en haut de l'écran ; à défaut (titres masqués ou absents), le verset
    const titleEl = document.querySelector<HTMLElement>(`[data-title-verse-id="${pendingScrollVerse.verseId}"]`);
    const titlesDone = !Object.values(versesLoading).some(Boolean);
    const el = titleEl ?? (titlesDone || !showTitles
      ? document.querySelector<HTMLElement>(`[data-verse-number="${pendingScrollVerse.verse}"]`)
      : null);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPendingScrollVerse(null);
  }, [pendingScrollVerse, loadedChapterKey, titleTranslations, versesLoading, showTitles]);

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
    applyVersionSelection(allCodes, allCodes[0]);
    toast({ title: `${allCodes.length} versions sélectionnées` });
  };

  const handleToggleVersion = (ver: DbBibleVersion) => {
    const isSelected = selectedVersions.includes(ver.code);
    if (isSelected) {
      const next = selectedVersions.filter(code => code !== ver.code);
      applyVersionSelection(next);
    } else {
      applyVersionSelection([...selectedVersions, ver.code], ver.code);
    }
  };

  const handleResetVersion = () => {
    applyVersionSelection([defaultVersionCode], defaultVersionCode);
    toast({ title: `Version réinitialisée à ${defaultVersionCode}` });
  };

  const handleVerseClick = (verse: any, versionCodeFromGrid: string) => {
    if (!selectedBook) return;
    const actualVersion = activeVersionRef.current || selectedVersionCode;
    
    console.group('[BiblePage] handleVerseClick');
    console.log('  verse:', verse.verse_number, verse.reference_code);
    console.log('  versionCodeFromGrid:', versionCodeFromGrid);
    console.log('  activeVersionRef.current:', activeVersionRef.current);
    console.log('  selectedVersionCode state:', selectedVersionCode);
    console.log('  selectedVersions:', selectedVersions);
    console.log('  selectedVersions[0]:', selectedVersions[0]);
    console.log('  actualVersion (used):', actualVersion);
    console.groupEnd();
    
    setSelectedVerseForTreasures({
      id: verse.id || verse.verse_number,
      verse_number: verse.verse_number,
      reference_code: verse.reference_code || `${selectedBook.code}.${selectedChapter}.${verse.verse_number}`,
      text: verse.text,
      book: selectedBook,
      chapter: selectedChapter,
      versionCode: actualVersion
    });
  };

  // afterVerse : le bloc de titres suit un verset → une ligne vide le sépare de ce verset
  const renderVerseTitles = (verseId: number, versionCode: string, afterVerse = false) => {
    if (!showTitles) return null;
    
    const versionTitles = titleTranslations[versionCode];
    if (!versionTitles) return null;
    
    const titleData = versionTitles[verseId];
    if (!titleData || !titleData.titles) return null;

    const entries = Object.entries(titleData.titles)
      .filter(([_, text]) => Boolean(text && String(text).trim()))
      .sort(([a], [b]) => Number(a) - Number(b));
    
    if (entries.length === 0) return null;

    return (
      <div data-title-verse-id={verseId} className={`w-full text-left ${afterVerse ? 'mt-[1em]' : 'mt-0.5'} mb-0.5 border-b border-amber-500/20 pb-0.5 scroll-mt-[70px] xl:scroll-mt-[100px]`}>
        {entries.map(([level, text]) => {
          const lvl = parseInt(level, 10);
          const style = TITLE_LEVEL_STYLES[lvl] ?? TITLE_LEVEL_STYLES[5];
          const Tag = (`h${Math.min(lvl + 2, 6)}`) as 'h3' | 'h4' | 'h5' | 'h6';
          return (
            <Tag
              key={level}
              className={`font-cambria leading-tight ${style.className}`}
              style={{ fontSize: style.fontSize }}
            >
              {text}
            </Tag>
          );
        })}
      </div>
    );
  };

  const handleScrollPrev = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth / 2;
      scrollContainerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScrollNext = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth / 2;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const renderVersionsGrid = () => {
    const hasMultiple = selectedVersions.length > 4;

    const gridContent = (
      <div 
        className={
          hasMultiple 
            ? "flex gap-4 min-w-full pb-2" 
            : `grid gap-4 ${
                selectedVersions.length === 1 
                  ? 'grid-cols-1' 
                  : selectedVersions.length === 2 
                    ? 'grid-cols-1 md:grid-cols-2' 
                    : selectedVersions.length === 3 
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
              }`
        }
      >
        {selectedVersions.map((versionCode) => {
          const versionObj = versions.find(v => v.code === versionCode) || { name: versionCode, code: versionCode };
          const verses = versesData[versionCode] || [];
          const isLoadingV = versesLoading[versionCode] || false;
          
          return (
            <div 
              key={versionCode} 
              className={`px-4 pb-4 pt-[11px] rounded-2xl rounded-t-none border border-t-0 border-border bg-card shadow-xs flex flex-col ${
                hasMultiple 
                  ? 'w-full md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)] shrink-0' 
                  : 'w-full'
              }`}
            >
              {selectedVersions.length > 1 && (
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {versionObj.name}
                  </span>
                </div>
              )}
              
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
                <div className="space-y-0.5 font-serif text-sm sm:text-base leading-snug flex-1" style={readerTextStyle}>
                  {verses.map((verse, verseIndex) => (
                    <div key={verse.id || verse.verse_number} data-verse-number={verse.verse_number} className="group scroll-mt-[70px] xl:scroll-mt-[100px]">
                      {renderVerseTitles(verse.id, versionCode, verseIndex > 0)}
                      <div 
                        onClick={() => handleVerseClick(verse, versionCode)}
                        className="flex items-start gap-[3px] px-1.5 py-0.5 rounded-xl hover:bg-amber-500/10 dark:hover:bg-amber-500/15 cursor-pointer transition-all group"
                        title="Cliquez pour voir les Références & Trésors"
                      >
                        <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 select-none pt-px shrink-0 min-w-[0.75rem]">
                          {verse.verse_number}
                        </span>
                        <p className="text-foreground flex-1">
                          {verse.text}
                        </p>
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="font-serif text-sm sm:text-base leading-relaxed text-foreground text-justify flex-1" style={readerTextStyle}>
                  {verses.map((verse, verseIndex) => {
                    const titlesHeader = renderVerseTitles(verse.id, versionCode, verseIndex > 0);
                    return (
                      <React.Fragment key={verse.id || verse.verse_number}>
                        {titlesHeader}
                        {/* Début de paragraphe : retour à la ligne + demi-ligne d'espace (inutile si un bloc de titres vient d'en créer un) */}
                        {verse.is_paragraph && verseIndex > 0 && !titlesHeader && <span className="block h-[0.5em]" aria-hidden="true" />}
                        <span 
                          data-verse-number={verse.verse_number}
                          onClick={() => handleVerseClick(verse, versionCode)}
                          className="inline scroll-mt-[70px] xl:scroll-mt-[100px] hover:bg-amber-500/15 dark:hover:bg-amber-500/20 rounded pr-1 py-0.5 cursor-pointer transition-colors"
                          title="Cliquez pour voir les Références & Trésors"
                        >
                          <sup className="font-sans font-bold text-xs text-amber-600 dark:text-amber-400 font-mono mr-0.5 select-none">
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

    if (hasMultiple) {
      return (
        <div className="relative">
          {canScrollLeft && (
            <button
              onClick={handleScrollPrev}
              className="hidden lg:flex fixed left-2 xl:left-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-card/95 hover:bg-amber-600 text-foreground hover:text-white border border-border shadow-2xl items-center justify-center transition-all hover:scale-110 active:scale-95 backdrop-blur-md"
              title="Faire défiler vers la gauche"
              aria-label="Versions précédentes"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}

          {canScrollRight && (
            <button
              onClick={handleScrollNext}
              className="hidden lg:flex fixed right-2 xl:right-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-card/95 hover:bg-amber-600 text-foreground hover:text-white border border-border shadow-2xl items-center justify-center transition-all hover:scale-110 active:scale-95 backdrop-blur-md"
              title="Faire défiler vers la droite"
              aria-label="Versions suivantes"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}

          <div className="lg:hidden flex items-center justify-end gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrollPrev}
              disabled={!canScrollLeft}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrollNext}
              disabled={!canScrollRight}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div
            ref={scrollContainerRef}
            className="overflow-x-auto overscroll-x-contain no-scrollbar scroll-smooth px-0.5"
          >
            {gridContent}
          </div>
        </div>
      );
    }

    return gridContent;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-amber-500/20 selection:text-amber-800">
      <Navbar
        currentVersion={selectedVersionCode}
        onVersionChange={(code) => {
          console.log('[BiblePage] Navbar onVersionChange:', code);
          applyVersionSelection([code], code);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
      />


      {/* Section de contrôle */}
      <section className="w-full bg-[#B45309] dark:bg-[#292524] xl:flex xl:h-[30px] xl:items-center xl:py-0 xl:sticky xl:top-[40px] xl:z-40">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 xl:my-0.5 xl:h-[25px]">
          <div className="flex flex-col gap-3 py-1 xl:flex-row xl:flex-nowrap xl:items-center xl:gap-2 xl:py-0 xl:h-full">
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
                compact
              />
            </div>

            <div className="shrink-0 xl:flex xl:h-6 xl:items-center">
              <ChapterNavigator
                selectedBook={selectedBook}
                selectedChapter={selectedChapter}
                booksList={booksList}
                onChapterChange={handleChapterChange}
                onBookChange={handleBookChange}
                titleLanguageId={targetLanguageId}
                onSelectTitle={handleSelectTitle}
                compact
              />
            </div>

            {/* Search bar */}
            <div className="flex-1 hidden md:block h-[25px]">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-full h-[25px] flex items-center justify-between px-3 py-0 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition-all group"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="truncate">Rechercher un verset, un livre...</span>
                </div>
                <kbd className="hidden lg:inline-block px-1.5 py-0 text-[10px] leading-4 font-mono bg-white/15 border border-white/30 rounded text-white">
                  ⌘K
                </kbd>
              </button>
            </div>

             {/* Mode et titres */}
            <div className="flex items-center gap-1.5 shrink-0 border-t border-white/30 xl:h-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowTitles(prev => !prev);
                }}
                aria-label={showTitles ? "Masquer les titres de section" : "Afficher les titres de section"}
                className={`h-9 w-9 rounded-md transition-all xl:h-6 xl:w-6 ${
                  showTitles
                    ? 'bg-white/25 text-white border-white/60 hover:bg-white/30 hover:text-white'
                    : 'bg-transparent text-white/80 border-white/30 hover:bg-white/15 hover:text-white'
                }`}
                title={showTitles ? "Masquer les titres de section" : "Afficher les titres de section"}
              >
                <BookMarked className={`w-3.5 h-3.5 ${showTitles ? 'fill-white/40' : ''}`} />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const nextMode = displayMode === 'compact' ? 'list' : 'compact';
                  setDisplayMode(nextMode);
                }}
                title={displayMode === 'compact' ? "Mode compact" : "Mode liste"}
                aria-label={displayMode === 'compact' ? "Mode compact" : "Mode liste"}
                className={`h-9 w-9 rounded-md transition-all xl:h-6 xl:w-6 ${
                  displayMode === 'list'
                    ? 'bg-white/25 text-white border-white/60 hover:bg-white/30 hover:text-white'
                    : 'bg-transparent text-white/80 border-white/30 hover:bg-white/15 hover:text-white'
                }`}
              >
                {displayMode === 'compact' ? (
                  <LayoutGrid className="w-3.5 h-3.5" />
                ) : (
                  <List className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>

            {/* Police et taille de lecture */}
            <div className="flex items-center gap-1.5 shrink-0 xl:h-6 xl:border-l xl:border-white/30 xl:pl-2">
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Police de lecture"
                        className="h-9 w-9 rounded-md bg-transparent border-white/30 text-white/80 hover:bg-white/15 hover:text-white xl:h-6 xl:w-6"
                      >
                        <Type className="w-3.5 h-3.5" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Police de lecture</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-52 p-1 max-h-[60vh] overflow-y-auto">
                  {READER_FONTS.map(font => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setReaderFontId(font.id)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted ${
                        readerFontId === font.id ? 'text-amber-700 dark:text-amber-300 font-semibold' : ''
                      }`}
                      style={{ fontFamily: font.family }}
                    >
                      {font.label}
                      {readerFontId === font.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Taille du texte"
                        className="h-9 w-9 rounded-md bg-transparent border-white/30 text-white/80 hover:bg-white/15 hover:text-white xl:h-6 xl:w-6"
                      >
                        <ALargeSmall className="w-3.5 h-3.5" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Taille du texte</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-40 p-1">
                  {READER_FONT_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setReaderFontSize(size)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded-md hover:bg-muted ${
                        readerFontSize === size ? 'text-amber-700 dark:text-amber-300 font-semibold' : ''
                      }`}
                    >
                      <span style={{ fontSize: `${size}px` }}>Aa</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {size}px
                        {readerFontSize === size && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

          </div>
        </div>
      </section>


      {/* Language and version selection bar */}
      <section className="h-[25px] border-b border-border/80 bg-[#D97706] dark:bg-[#78350F] backdrop-blur-md sticky top-[40px] xl:top-[70px] z-30 shadow-sm">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain no-scrollbar">
            {/* Language menu icon (click to open dropdown) */}
            <Popover open={isLanguageMenuOpen} onOpenChange={setIsLanguageMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Afficher les langues et versions"
                  aria-expanded={isLanguageMenuOpen}
                  className={`bg-transparent p-0.5 transition-colors flex items-center shrink-0 ${
                    isLanguageMenuOpen
                      ? 'text-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Menu className="w-[13px] h-[13px]" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={8}
                className="z-[100] w-[min(80rem,calc(100vw-2rem))] overflow-hidden rounded-xl p-0"
              >
                <div className="max-h-[70vh] overflow-auto p-2">
                  <table className="mt-2 w-max min-w-[64rem] border-collapse text-left text-xs">
                    <thead>
                      <tr>
                        {orderedLanguages.map(lang => (
                          <th key={lang.id} className="min-w-28 border-b border-border px-2 py-2 align-top">
                            <label className="flex cursor-pointer items-center gap-2 font-semibold">
                              <input
                                type="checkbox"
                                checked={selectedLanguageIds.includes(lang.id)}
                                onChange={event => {
                                  if (event.target.checked) {
                                    setSelectedLanguageIds(prev => prev.includes(lang.id) ? prev : [...prev, lang.id]);
                                  } else {
                                    setSelectedLanguageIds(prev => prev.filter(id => id !== lang.id));
                                  }
                                }}
                                className="h-3 w-3 rounded text-amber-600"
                              />
                              <span>{lang.name.toUpperCase()}</span>
                            </label>
                            {/* <span className="mt-1 block font-normal text-muted-foreground">{lang.name}</span> */}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: versionRowsCount }, (_, rowIndex) => (
                        <tr key={rowIndex}>
                          {languageVersionColumns.map(({ language, versions: languageVersions }) => {
                            const version = languageVersions[rowIndex];
                            return (
                              <td key={language.id} className="border-r border-border/60 px-0 py-px align-top leading-none last:border-r-0">
                                {version && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        role="checkbox"
                                        aria-checked={selectedVersions.includes(version.code)}
                                        tabIndex={0}
                                        onClick={() => handleToggleVersion(version)}
                                        onKeyDown={event => {
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            handleToggleVersion(version);
                                          }
                                        }}
                                        className={`inline cursor-pointer whitespace-nowrap pl-px text-[10px] leading-none ${
                                          selectedVersions.includes(version.code)
                                            ? 'font-semibold text-amber-700 dark:text-amber-300'
                                            : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                      >
                                        {version.name}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                      {version.name}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PopoverContent>
            </Popover>

            {/* Tout button */}
            <button
              onClick={() => {
                const allCodes = filteredVersions.map(v => v.code);
                const allSelected = allCodes.length > 0
                  && allCodes.every(code => selectedVersions.includes(code));
                if (allSelected) {
                  applyVersionSelection([]);
                } else {
                  applyVersionSelection(allCodes, allCodes[0]);
                }
              }}
              className={`bg-transparent px-1 text-[13px] leading-none font-mono font-bold transition-colors shrink-0 ${
                filteredVersions.length > 0 && filteredVersions.every(version => selectedVersions.includes(version.code))
                  ? 'text-white underline underline-offset-2'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Tout
            </button>

            <table className="h-full w-max shrink-0 border-collapse whitespace-nowrap text-left text-[11px]">
              <tbody>
                <tr>
                  {displayedLanguages.map(lang => {
                    const langVersions = filteredVersions.filter(v => v.language_id === lang.id);
                    const allLanguageVersionsSelected = langVersions.length > 0
                      && langVersions.every(version => selectedVersions.includes(version.code));
                    return (
                      <td key={lang.id} className={`h-full border-r border-border/70 px-2 align-middle last:border-r-0`}>
                        <div className="flex h-full items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleToggleLanguageVersions(lang.id)}
                                aria-pressed={allLanguageVersionsSelected}
                                className={`shrink-0 cursor-pointer whitespace-nowrap font-sans text-[13px] font-bold leading-none text-white ${allLanguageVersionsSelected ? 'underline decoration-2 underline-offset-2' : 'hover:opacity-75'}`}
                              >
                                {toProperCase(lang.code)}{'\u00A0:'}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {lang.name}
                            </TooltipContent>
                          </Tooltip>
                          <div className="flex h-full items-center gap-1 whitespace-nowrap">
                            {langVersions.map(version => (
                              <Tooltip key={version.code}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVersion(version)}
                                    aria-pressed={selectedVersions.includes(version.code)}
                                    className={`flex h-full shrink-0 cursor-pointer items-center whitespace-nowrap px-0.5 font-cambria text-[13px] leading-none transition-colors text-white ${
                                      selectedVersions.includes(version.code)
                                        ? 'underline decoration-2 underline-offset-2'
                                        : 'font-medium opacity-75 hover:opacity-100'
                                    }`}
                                  >
                                    {version.code}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  {version.name}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>



      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-6 space-y-6">
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

        <VerseTreasuresModal
          isOpen={!!selectedVerseForTreasures}
          onClose={() => {
            console.log('[BiblePage] Closing VerseTreasuresModal');
            setSelectedVerseForTreasures(null);
          }}
          selectedVerse={selectedVerseForTreasures}
          booksList={booksList}
          versions={versions}
          testamentsList={testamentsList}
          classificationsList={classificationsList}
          testamentNames={testamentNames}
          classificationNames={classificationNames}
          showTitles={showTitles}
          onToggleShowTitles={() => setShowTitles(prev => !prev)}
          displayMode={displayMode}
          onToggleDisplayMode={() => setDisplayMode(prev => prev === 'compact' ? 'list' : 'compact')}
          onNavigateToPassage={(book, chapter) => {
            setSelectedBook(book);
            setSelectedChapter(chapter);
          }}
        />

        <ReaderDialog
          isOpen={readerState.isOpen}
          onClose={() => setReaderState(prev => ({ ...prev, isOpen: false }))}
          bookId={readerState.bookCode}
          chapterNumber={readerState.chapterNumber}
          currentVersion={selectedVersionCode}
          selectedVersions={selectedVersions}
          onChapterChange={(bookId, chapter) => {
            setReaderState(prev => ({ ...prev, bookCode: bookId, chapterNumber: chapter }));
            const matchedBook = booksList.find(b => b.code === bookId);
            if (matchedBook) {
              setSelectedBook(matchedBook);
              setSelectedChapter(chapter);
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
              activeVersionRef.current = activeVersion.code;
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
              activeVersionRef.current = activeVersion.code;
            }
          }}
        />

        <DbStatusModal
          isOpen={isDbStatusOpen}
          onClose={() => setIsDbStatusOpen(false)}
        />

        {/* <footer className="border-t border-border/80 bg-muted/20 py-8 mt-12">
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
        </footer> */}
      </main>
    </div>
  );
};

export default BiblePage;