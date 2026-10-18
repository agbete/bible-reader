import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  BookMarked, 
  Loader2, 
  Link2,
  Gem,
  Scroll,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookSearchSelect } from '@/components/bible/BookSearchSelect';
import { ChapterNavigator } from '@/components/bible/ChapterNavigator';
import { 
  DbBookItem, 
  DbTreasureItem, 
  DbCrossReferenceItem,
  getDbVerseCrossReferences,
  getDbVerseTreasures,
  getDbChapterVerses,
  getDbBookNameEntries
} from '@/services/bibleDb';

// Version de référence toujours affichée au-dessus du verset source, quelle que soit la version choisie
const REFERENCE_VERSION_CODE = 'KJV';
import { supabase } from '@/integrations/supabase/client';

interface VerseTreasuresModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVerse: {
    id: number;
    verse_number: number;
    reference_code: string;
    text: string;
    book: DbBookItem;
    chapter: number;
    versionCode: string;
  } | null;
  booksList: DbBookItem[];
  versions: DbBibleVersion[];
  testamentsList: { id: number; code: string; name: string }[];
  classificationsList: { id: number; name: string; code?: string; testament_id: number }[];
  testamentNames: Map<number, string>;
  classificationNames: Map<number, string>;
  showTitles: boolean;
  onToggleShowTitles: () => void;
  /** verse : verset à atteindre dans le chapitre (défilement + surlignage) */
  onNavigateToPassage: (book: DbBookItem, chapter: number, verse?: number) => void;
}

export const VerseTreasuresModal: React.FC<VerseTreasuresModalProps> = ({
  isOpen,
  onClose,
  selectedVerse,
  booksList,
  versions,
  testamentsList,
  classificationsList,
  testamentNames,
  classificationNames,
  showTitles,
  onToggleShowTitles,
  onNavigateToPassage
}) => {
  const [activeBook, setActiveBook] = useState<DbBookItem | null>(null);
  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [activeVerseNumber, setActiveVerseNumber] = useState<number>(1);
  const [activeVerseText, setActiveVerseText] = useState<string>('');
  // Versets du chapitre affiché (numéro + reference_code), pour le sélecteur de verset
  const [chapterVerses, setChapterVerses] = useState<{ number: number; reference: string }[]>([]);
  const [verseDropdownOpen, setVerseDropdownOpen] = useState(false);
  const verseSelectRef = useRef<HTMLDivElement>(null);
  // Même verset dans la version de référence (KJV) et nom du livre dans sa langue
  const [referenceVerseText, setReferenceVerseText] = useState<string>('');
  const [referenceBookName, setReferenceBookName] = useState<string>('');
  // Thème survolé dans la colonne des trésors : surligné dans le texte du verset
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  // Noms des livres par langue (clé "languageId|CODE"), pour afficher les livres dans la langue de la version choisie
  const [bookNamesByLanguage, setBookNamesByLanguage] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    getDbBookNameEntries().then(entries => {
      const map = new Map<string, string>();
      entries.forEach(e => { if (e.language_id) map.set(`${e.language_id}|${e.code}`, e.name); });
      setBookNamesByLanguage(map);
    });
  }, []);
  const [activeReferenceCode, setActiveReferenceCode] = useState<string>('');

  const [crossReferences, setCrossReferences] = useState<DbCrossReferenceItem[]>([]);
  const [treasures, setTreasures] = useState<DbTreasureItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Version selector state
  const [displayVersionCode, setDisplayVersionCode] = useState<string>('');
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const activeVersionRef = useRef<string>('');

  // Title language state
  const [titleLanguageId, setTitleLanguageId] = useState<number | null>(null);
  const [titleLanguageOptions, setTitleLanguageOptions] = useState<Array<{id:number, name:string}>>([]);

  // Refs for click-outside detection
  const versionSelectRef = useRef<HTMLDivElement>(null);
  // Sélecteur des thèmes de trésors (en-tête) et thème choisi
  const themeSelectRef = useRef<HTMLDivElement>(null);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number | null>(null);

  // Track latest request to avoid stale responses
  const latestRequestRef = useRef<string>('');

  // Initialize display version from selectedVerse
  useEffect(() => {
    if (selectedVerse) {
      setDisplayVersionCode(selectedVerse.versionCode);
    }
  }, [selectedVerse]);

  // Set title language to match the currently selected version WHEN MODAL OPENS
  useEffect(() => {
    if (isOpen && displayVersionCode) {
      const versionObj = versions.find(v => v.code === displayVersionCode);
      const versionLanguageId = versionObj?.language_id ?? 2;
      setTitleLanguageId(versionLanguageId);
    }
  }, [isOpen, displayVersionCode, versions]);

  // Sync state when selected verse changes or modal opens (for book/chapter/etc.)
  useEffect(() => {
    if (selectedVerse && isOpen) {
      setActiveBook(selectedVerse.book);
      setActiveChapter(selectedVerse.chapter);
      setActiveVerseNumber(selectedVerse.verse_number);
      setActiveVerseText(selectedVerse.text);
      setActiveReferenceCode(selectedVerse.reference_code);
    }
  }, [selectedVerse, isOpen]);

  // Update ref when version changes
  useEffect(() => {
    activeVersionRef.current = displayVersionCode;
  }, [displayVersionCode]);

  // Load title language options (treasure translations languages)
  useEffect(() => {
    const loadTitleLanguageOptions = async () => {
      try {
        const { data } = await supabase
          .from('treasure_translations')
          .select('language_id, languages!inner(name, code)')
          .order('language_id');
        if (data) {
          const langs = data
            .map(d => ({
              id: d.language_id,
              name: d.languages?.name || d.languages?.code || `Langue ${d.language_id}`
            }))
            .filter((v, i, self) => self.findIndex(t => t.id === v.id) === i);
          setTitleLanguageOptions(langs);
        }
      } catch (err) {
        console.error('Failed to load title languages:', err);
      }
    };
    loadTitleLanguageOptions();
  }, []);

  // Load references + treasures whenever reference, version, or title language changes
  useEffect(() => {
    if (!isOpen) return;
    if (!activeReferenceCode) return;

    const versionToUse = displayVersionCode;
    const langIdForTreasure = titleLanguageId ?? (versions.find(v => v.code === versionToUse)?.language_id ?? 2);
    
    const currentSnapshot = `${activeReferenceCode}__${versionToUse}__${langIdForTreasure}`;
    
    // Skip if same request is already in flight
    if (latestRequestRef.current === currentSnapshot) return;
    latestRequestRef.current = currentSnapshot;

    setLoading(true);
    setCrossReferences([]);
    setTreasures([]);

    // Get language ID from version for verse texts
    const versionObj = versions.find(v => v.code === versionToUse);
    const languageIdForVerses = versionObj?.language_id ?? 2;

    console.log('[VerseTreasuresModal] Loading with version:', versionToUse, 
      'verseLanguageId:', languageIdForVerses, 
      'titleLanguageId:', langIdForTreasure);

    Promise.all([
      getDbVerseCrossReferences(activeReferenceCode, versionToUse, languageIdForVerses),
      getDbVerseTreasures(activeReferenceCode, 'fr', versionToUse, langIdForTreasure)
    ])
      .then(([crossRes, treasuresRes]) => {
        // Ignore stale responses
        if (latestRequestRef.current !== currentSnapshot) {
          console.log('[VerseTreasuresModal] Stale response ignored');
          return;
        }
        
        console.log('[VerseTreasuresModal] API responses:', {
          crossCount: crossRes?.length,
          treasuresCount: treasuresRes?.length,
          version: versionToUse,
          verseLanguageId: languageIdForVerses,
          titleLanguageId: langIdForTreasure
        });
        
        setCrossReferences(crossRes || []);
        setTreasures(treasuresRes || []);
      })
      .catch((err) => {
        console.error('[VerseTreasuresModal] Error:', err);
        if (latestRequestRef.current === currentSnapshot) {
          setCrossReferences([]);
          setTreasures([]);
        }
      })
      .finally(() => {
        if (latestRequestRef.current === currentSnapshot) {
          setLoading(false);
        }
      });

  }, [isOpen, activeReferenceCode, displayVersionCode, versions, titleLanguageId]);

  // Effect to fetch verse text when display version changes
  useEffect(() => {
    if (!isOpen || !activeBook || !displayVersionCode) return;

    const fetchVerseText = async () => {
      try {
        const verses = await getDbChapterVerses(activeBook.id, activeChapter, displayVersionCode);
        setChapterVerses(verses.map(v => ({ number: v.verse_number, reference: v.reference_code })));
        const verse = verses.find(v => v.verse_number === activeVerseNumber);
        if (verse) {
          setActiveVerseText(verse.text);
        } else {
          setActiveVerseText('[Texte non disponible]');
        }
      } catch (err) {
        console.error('[VerseTreasuresModal] Error fetching verse text:', err);
        setActiveVerseText('[Erreur de chargement]');
      }
    };

    fetchVerseText();
  }, [isOpen, activeBook, activeChapter, activeVerseNumber, displayVersionCode]);

  // Verset en KJV : ne dépend pas de la version choisie dans la fenêtre
  useEffect(() => {
    if (!isOpen || !activeBook) return;
    let cancelled = false;
    (async () => {
      try {
        const referenceLanguageId = versions.find(v => v.code === REFERENCE_VERSION_CODE)?.language_id;
        const [verses, bookNames] = await Promise.all([
          getDbChapterVerses(activeBook.id, activeChapter, REFERENCE_VERSION_CODE),
          getDbBookNameEntries()
        ]);
        if (cancelled) return;
        const verse = verses.find(v => v.verse_number === activeVerseNumber);
        setReferenceVerseText(verse && !verse.is_missing ? verse.text : '[Text not available]');
        const name = bookNames.find(b => b.code === activeBook.code && b.language_id === referenceLanguageId)?.name;
        setReferenceBookName(name || activeBook.name);
      } catch (err) {
        console.error('[VerseTreasuresModal] Error fetching KJV verse:', err);
        if (!cancelled) setReferenceVerseText('[Loading error]');
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, activeBook, activeChapter, activeVerseNumber, versions]);

  // Nouveau verset / nouveaux thèmes : le premier thème est sélectionné par défaut
  useEffect(() => {
    setSelectedThemeIndex(treasures.length > 0 ? 0 : null);
  }, [treasures]);

  // Click-outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionSelectRef.current && !versionSelectRef.current.contains(event.target as Node)) {
        setVersionDropdownOpen(false);
      }
      if (themeSelectRef.current && !themeSelectRef.current.contains(event.target as Node)) {
        setThemeDropdownOpen(false);
      }
      if (verseSelectRef.current && !verseSelectRef.current.contains(event.target as Node)) {
        setVerseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Livres dans la langue de la version choisie dans la fenêtre
  const displayLanguageId = versions.find(v => v.code === displayVersionCode)?.language_id;
  const localizedBooks = useMemo(
    () => booksList.map(b => {
      const name = bookNamesByLanguage.get(`${displayLanguageId}|${b.code}`);
      return name ? { ...b, name } : b;
    }),
    [booksList, bookNamesByLanguage, displayLanguageId]
  );
  const localizedActiveBook = activeBook ? (localizedBooks.find(b => b.id === activeBook.id) ?? activeBook) : null;

  if (!isOpen || !activeBook || !localizedActiveBook) return null;

  const activeDisplayRef = `${localizedActiveBook.name} ${activeChapter}:${activeVerseNumber}`;

  // Référence cliquée : ouvre le passage dans la page et va au verset
  const goToVerse = (book: DbBookItem, chapter: number, verse: number) => {
    onNavigateToPassage(book, chapter, verse);
    onClose();
  };

  const handleSelectBookFromHeader = async (book: DbBookItem, chapter: number) => {
    setActiveBook(book);
    setActiveChapter(chapter);
    setActiveVerseNumber(1);
    
    try {
      const verses = await getDbChapterVerses(book.id, chapter, displayVersionCode);
      if (verses && verses.length > 0) {
        setActiveVerseText(verses[0].text);
        setActiveReferenceCode(verses[0].reference_code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChapterChangeFromHeader = async (chapter: number) => {
    if (!activeBook) return;
    setActiveChapter(chapter);
    setActiveVerseNumber(1);
    
    try {
      const verses = await getDbChapterVerses(activeBook.id, chapter, displayVersionCode);
      if (verses && verses.length > 0) {
        setActiveVerseText(verses[0].text);
        setActiveReferenceCode(verses[0].reference_code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerseChangeFromHeader = (verseNumber: number) => {
    const target = chapterVerses.find(v => v.number === verseNumber);
    if (!target) return;
    setActiveVerseNumber(verseNumber);
    setActiveReferenceCode(target.reference);
    setVerseDropdownOpen(false);
  };

  const handleVersionChange = (newVersion: string) => {
    console.log('[VerseTreasuresModal] Changing version from', displayVersionCode, 'to', newVersion);
    setDisplayVersionCode(newVersion);
    setVersionDropdownOpen(false);
    // When version changes, reset title language to match new version
    const versionObj = versions.find(v => v.code === newVersion);
    const newLangId = versionObj?.language_id ?? 2;
    setTitleLanguageId(newLangId);
  };

  // Helper to format "Livre Chapitre:Verset"
  // Nom propre : « MATTHIEU » ou « 1CH » → « Matthieu », « 1 Ch »
  const toProperName = (name: string) => {
    const spaced = name.replace(/^(\d)(\p{L})/u, '$1 $2');
    if (spaced !== spaced.toUpperCase()) return spaced; // déjà en casse normale
    return spaced.toLocaleLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase());
  };

  // « Livre chapitre:verset » : nom du livre dans la langue de la version, sinon en anglais, sinon le code
  const formatHumanReference = (bookCode: string, chapter: number, verseNum: number, fallbackBookName?: string): string => {
    const code = bookCode.toUpperCase();
    const englishLanguageId = versions.find(v => v.code === REFERENCE_VERSION_CODE)?.language_id;
    const candidates = [
      fallbackBookName,
      bookNamesByLanguage.get(`${displayLanguageId}|${code}`),
      booksList.find(b => b.code.toUpperCase() === code)?.name,
      bookNamesByLanguage.get(`${englishLanguageId}|${code}`)
    ];
    const name = candidates.find(n => n && n.toUpperCase() !== code) ?? bookCode;
    return `${toProperName(name)} ${chapter}:${verseNum}`;
  };

  const parseRefCodeToHuman = (refCode: string): string => {
    if (!refCode) return '';
    const parts = refCode.split('.');
    if (parts.length === 3) {
      const [bCode, ch, v] = parts;
      return formatHumanReference(bCode, parseInt(ch, 10), parseInt(v, 10));
    }
    return refCode;
  };

  // Get available languages for treasure titles (for loading state)
  const availableTitleLanguages = titleLanguageOptions
    .map(opt => opt.name)
    .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates

  // Surligne le thème survolé (mot ou expression du verset, ex. « that whosoever ») partout où il apparaît,
  // en mot entier et sans tenir compte des majuscules
  const highlightTheme = (text: string): React.ReactNode => {
    const activeTheme = hoveredTheme ?? (selectedThemeIndex !== null ? treasures[selectedThemeIndex]?.title : null);
    const theme = activeTheme?.trim().replace(/[.,;:!?]+$/, '');
    if (!theme || !text) return text;
    const escaped = theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, 'giu');
    const parts = text.split(pattern);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      i % 2 === 1
        ? <mark key={i} className="bg-amber-300/70 dark:bg-amber-500/50 text-inherit rounded-sm px-0.5 not-italic font-semibold">{part}</mark>
        : part
    );
  };

  // Nombre de trésors trouvés : versets cibles de tous les thèmes
  const treasureCount = treasures.reduce(
    (sum, t) => sum + (t.target_items?.length || t.target_references?.length || 0),
    0
  );

  // Helper to check if a treasure has any non-empty titles
  const hasValidTitles = (treasure: DbTreasureItem): boolean => {
    if (!showTitles) return false;
    if (!treasure.title || treasure.title.trim() === '') return false;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="relative w-[95vw] h-[95vh] max-w-7xl bg-background rounded-3xl rounded-t-none border border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="w-full bg-[#B45309] dark:bg-[#292524] border-b border-black/20 dark:border-white/10 text-white px-4 sm:px-6 py-3 xl:py-0 xl:h-[30px] xl:flex xl:items-center shrink-0">
          <div className="w-full flex flex-col xl:flex-row gap-3 xl:gap-2 items-stretch xl:items-center justify-between xl:h-6">
            <div className="flex-1 min-w-0">
              <BookSearchSelect
                booksList={localizedBooks}
                selectedBook={localizedActiveBook}
                selectedChapter={activeChapter}
                onSelectBook={handleSelectBookFromHeader}
                currentVersion={displayVersionCode}
                testamentsList={testamentsList}
                classificationsList={classificationsList}
                testamentNames={testamentNames}
                classificationNames={classificationNames}
                compact
              />
            </div>

            <div className="shrink-0 xl:flex xl:h-6 xl:items-center">
              <ChapterNavigator
                selectedBook={localizedActiveBook}
                selectedChapter={activeChapter}
                booksList={localizedBooks}
                onChapterChange={handleChapterChangeFromHeader}
                onBookChange={(b) => handleSelectBookFromHeader(b, 1)}
                showTitleNavigator={false}
                compact
              />
            </div>

            {/* SÉLECTEUR DE VERSET (verset précédent / suivant à l'intérieur) */}
            {(() => {
              const index = chapterVerses.findIndex(v => v.number === activeVerseNumber);
              const prevVerse = index > 0 ? chapterVerses[index - 1] : null;
              const nextVerse = index >= 0 && index < chapterVerses.length - 1 ? chapterVerses[index + 1] : null;
              const arrow = 'h-full px-1 flex items-center rounded-full text-white hover:bg-white/15 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';
              return (
                <div className="relative shrink-0" ref={verseSelectRef}>
                  <div className="h-9 xl:h-6 px-0.5 rounded-full bg-white/10 border border-white/30 text-white text-[18px] leading-none font-bold flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => prevVerse && handleVerseChangeFromHeader(prevVerse.number)}
                      disabled={!prevVerse}
                      className={arrow}
                      title="Verset précédent"
                      aria-label="Verset précédent"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerseDropdownOpen(prev => !prev)}
                      disabled={chapterVerses.length === 0}
                      className="h-full px-1 rounded-full hover:bg-white/15 flex items-center gap-0.5 transition-colors"
                      title="Choisir un verset"
                    >
                      <span className="text-[11px] font-normal text-white/70 mr-0.5">v.</span>
                      <span>{activeVerseNumber}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${verseDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => nextVerse && handleVerseChangeFromHeader(nextVerse.number)}
                      disabled={!nextVerse}
                      className={arrow}
                      title="Verset suivant"
                      aria-label="Verset suivant"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {verseDropdownOpen && chapterVerses.length > 0 && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-40 w-72 bg-card text-foreground border border-border rounded-2xl shadow-2xl p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                        Versets
                      </div>
                      <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
                        {chapterVerses.map(v => (
                          <button
                            key={v.number}
                            type="button"
                            onClick={() => handleVerseChangeFromHeader(v.number)}
                            className={`h-8 rounded-lg text-xs font-bold font-mono transition-colors ${
                              v.number === activeVerseNumber ? 'bg-amber-600 text-white' : 'hover:bg-amber-500/15 text-foreground'
                            }`}
                          >
                            {v.number}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* THÈMES DE TRÉSORS (à la place des titres de section) */}
            <div className="relative shrink-0" ref={themeSelectRef}>
              <button
                type="button"
                onClick={() => setThemeDropdownOpen(prev => !prev)}
                disabled={treasures.length === 0}
                className="h-9 max-w-[18rem] px-2.5 rounded-md border border-white/30 bg-white/10 text-white text-xs flex items-center gap-1.5 transition-colors hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed xl:h-6 xl:px-1.5"
                title={treasures.length > 0 ? 'Aller à un thème de trésors' : 'Aucun thème pour ce verset'}
              >
                <Gem className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {selectedThemeIndex !== null && treasures[selectedThemeIndex]
                    ? treasures[selectedThemeIndex].title
                    : `Thèmes (${treasures.length})`}
                </span>
                <ChevronDown className={`w-3 h-3 shrink-0 text-white/80 transition-transform ${themeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {themeDropdownOpen && treasures.length > 0 && (
                <div className="absolute left-0 mt-1 w-[min(20rem,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto bg-card text-foreground border border-border rounded-xl shadow-lg z-20 p-1">
                  {treasures.map((treasure, index) => {
                    const count = treasure.target_items?.length || treasure.target_references?.length || 0;
                    return (
                      <button
                        key={treasure.treasure_id || index}
                        type="button"
                        onClick={() => {
                          setSelectedThemeIndex(index);
                          setThemeDropdownOpen(false);
                          document.getElementById(`treasure-theme-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-muted ${
                          selectedThemeIndex === index ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold' : ''
                        }`}
                      >
                        <span className="truncate font-cambria">{treasure.title || '—'}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                          {count} trésor{count > 1 ? 's' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 border-t xl:border-t-0 xl:border-l border-white/30 pt-2 xl:pt-0 xl:pl-2 xl:h-6">


              {/* VERSION SELECTOR */}
              <div className="relative" ref={versionSelectRef}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setVersionDropdownOpen(!versionDropdownOpen);
                  }}
                  className="h-9 px-3 rounded-full text-xs gap-1.5 font-medium transition-all border border-white/30 bg-white/10 text-white flex items-center gap-1.5 cursor-pointer hover:bg-white/20 xl:h-6 xl:px-2 min-w-[9rem] justify-between"
                >
                  <span>Version {displayVersionCode.toUpperCase()}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${versionDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {versionDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-[min(20rem,calc(100vw-2rem))] bg-card border border-border rounded-xl shadow-lg z-20 max-h-[60vh] overflow-y-auto">
                    {versions.map(v => (
                      <button
                        key={v.code}
                        onClick={() => {
                          setDisplayVersionCode(v.code);
                          setVersionDropdownOpen(false);
                          // When version changes, reset title language to match new version
                          const versionObj = versions.find(v => v.code === v.code);
                          const newLangId = versionObj?.language_id ?? 2;
                          setTitleLanguageId(newLangId);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          v.code === displayVersionCode
                            ? 'bg-amber-500/15 text-amber-700 font-semibold'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <span className="font-mono shrink-0 w-14">{v.code.toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground truncate">{v.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleShowTitles}
                className={`h-9 px-3 rounded-full text-xs gap-1.5 font-medium transition-all xl:h-6 xl:px-2 ${
                  showTitles
                    ? 'bg-white/25 text-white border-white/60 hover:bg-white/30 hover:text-white'
                    : 'bg-transparent text-white/80 border-white/30 hover:bg-white/15 hover:text-white'
                }`}
              >
                <BookMarked className={`w-3.5 h-3.5 ${showTitles ? 'fill-white/40' : ''}`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 rounded-full text-white/80 hover:text-white hover:bg-white/15 ml-1 xl:h-6 xl:w-6"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* BANDEAU VERSET EN KJV — masqué quand la version choisie est déjà la KJV */}
        {displayVersionCode.toUpperCase() !== REFERENCE_VERSION_CODE && (
          <div className="w-full min-h-[30px] bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-500/20 px-4 sm:px-6 py-1 shrink-0 flex items-center">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[16px] font-bold font-cambria shrink-0 shadow-xs leading-5">
                {referenceBookName || activeBook.name} {activeChapter}:{activeVerseNumber}
              </span>
              <blockquote className="flex-1 min-w-0 font-cambria text-[16px] text-foreground italic leading-snug pt-px">
                {highlightTheme(referenceVerseText)}
              </blockquote>
              {/* Version du verset, tout à droite */}
              <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[14px] font-bold font-cambria shrink-0 shadow-xs leading-4 mt-0.5">
                {REFERENCE_VERSION_CODE}
              </span>
            </div>
          </div>
        )}

        {/* BANDEAU VERSET SOURCE (version choisie) */}
        <div className="w-full min-h-[30px] bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-500/20 px-4 sm:px-6 py-1 shrink-0 flex items-center">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[16px] font-bold font-cambria shrink-0 shadow-xs leading-5">
              {activeDisplayRef}
            </span>
            <blockquote className="flex-1 min-w-0 font-cambria text-[16px] text-foreground italic leading-snug pt-px">
              {activeVerseText ? highlightTheme(activeVerseText) : 'Sélectionnez un verset...'}
            </blockquote>
            {/* Version du verset, tout à droite */}
            <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[14px] font-bold font-cambria shrink-0 shadow-xs leading-4 mt-0.5">
              {displayVersionCode.toUpperCase()}
            </span>
          </div>
        </div>

        {/* BODY: TWO COLUMNS */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-background divide-y lg:divide-y-0 lg:divide-x divide-border">
          
          {/* COLONNE 1: RÉFÉRENCES CROISÉES */}
          <div className="px-4 sm:px-6 pt-2 pb-4 sm:pb-6 flex flex-col overflow-hidden bg-muted/5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight tracking-tight text-foreground">Références Croisées</h3>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-serif">
                {crossReferences.length} réf{crossReferences.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-[10px]">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs">Chargement... (version: {displayVersionCode})</span>
                </div>
              ) : crossReferences.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Link2 className="w-10 h-10 mx-auto text-muted-foreground/30 stroke-1" />
                  <p className="text-sm font-semibold">Aucune référence croisée</p>
                  <p className="text-xs">Version: {displayVersionCode}</p>
                </div>
              ) : (
                crossReferences.map((refItem) => {
                  const matchedBook = booksList.find(b => b.code.toLowerCase() === refItem.book_code.toLowerCase());
                  const humanRef = formatHumanReference(refItem.book_code, refItem.chapter, refItem.verse_number, refItem.book_name);

                  return (
                    <div key={refItem.id} className="font-cambria text-[16px] leading-snug">
                      {matchedBook ? (
                        <button
                          type="button"
                          onClick={() => goToVerse(matchedBook, refItem.chapter, refItem.verse_number)}
                          className="block font-bold text-blue-700 dark:text-blue-300 underline underline-offset-2 decoration-blue-500/40 hover:decoration-blue-600 text-left"
                          title={`Aller à ${humanRef}`}
                        >
                          {humanRef}
                        </button>
                      ) : (
                        <span className="block font-bold text-blue-700 dark:text-blue-300">{humanRef}</span>
                      )}
                      <p className="text-foreground">{refItem.text || '[Texte non disponible]'}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLONNE 2: TRÉSORS */}
          <div className="px-4 sm:px-6 pt-2 pb-4 sm:pb-6 flex flex-col overflow-hidden bg-background">
            <div className="flex items-center justify-between pb-1.5 border-b border-border mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Gem className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight tracking-tight text-foreground">Trésors de l'Écriture</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-serif">
                  {treasures.length} thème{treasures.length > 1 ? 's' : ''}
                </span>
                {/* Nombre de trésors : versets trouvés, tous thèmes confondus */}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-serif">
                  {treasureCount} trésor{treasureCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3.5">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  <div className="space-y-2">
                    {/* Show available languages for treasure titles during loading */}
                    {availableTitleLanguages.length > 0 ? (
                      <>
                        <span className="text-xs font-medium">Titres disponibles dans :</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {availableTitleLanguages.map((lang, index) => (
                            <span key={index} className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs">Chargement des langues de titre...</span>
                    )}
                  </div>
                </div>
              ) : treasures.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Gem className="w-10 h-10 mx-auto text-muted-foreground/30 stroke-1" />
                  <p className="text-sm font-semibold">Aucun trésor répertorié</p>
                  <p className="text-xs">Version: {displayVersionCode}</p>
                </div>
              ) : (
                treasures.map((treasure, index) => {
                  const renderTargetItems = () => {
                    if (!treasure.target_items || treasure.target_items.length === 0) {
                      return (
                        <div className="flex flex-wrap gap-1.5">
                          {treasure.target_references.map((refCode, rIdx) => (
                            <span key={rIdx} className="px-2 py-1 rounded-lg bg-muted font-serif text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-border">
                              {parseRefCodeToHuman(refCode)}
                            </span>
                          ))}
                        </div>
                      );
                    }

                    return (
                        <div className="space-y-[10px]">
                          {treasure.target_items.map((target, tIdx) => {
                            const matchedBook = booksList.find(b => b.code.toLowerCase() === target.book_code.toLowerCase());
                            const humanRef = formatHumanReference(target.book_code, target.chapter, target.verse_number, target.book_name);

                            return (
                              <div key={tIdx} className="font-cambria text-[16px] leading-snug">
                                {matchedBook ? (
                                  <button
                                    type="button"
                                    onClick={() => goToVerse(matchedBook, target.chapter, target.verse_number)}
                                    className="block font-bold text-amber-700 dark:text-amber-400 underline underline-offset-2 decoration-amber-500/40 hover:decoration-amber-600 text-left"
                                    title={`Aller à ${humanRef}`}
                                  >
                                    {humanRef}
                                  </button>
                                ) : (
                                  <span className="block font-bold text-amber-700 dark:text-amber-400">{humanRef}</span>
                                )}
                                <p className="text-foreground">{target.text || ''}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                  };

                  // Check if this treasure should show the title number
                  const showTitleNumber = hasValidTitles(treasure);

                  return (
                    <div
                      key={treasure.treasure_id || index}
                      id={`treasure-theme-${index}`}
                      className={`space-y-3 scroll-mt-2 rounded-md transition-colors ${selectedThemeIndex === index ? 'bg-amber-500/10 ring-1 ring-amber-500/40 p-2 -m-2' : ''}`}
                      onMouseEnter={() => setHoveredTheme(treasure.title || null)}
                      onMouseLeave={() => setHoveredTheme(null)}
                    >
                      {showTitleNumber && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-foreground font-serif">{treasure.title}</h4>
                            {treasure.description && <span className="text-[11px] text-muted-foreground italic line-clamp-1">{treasure.description}</span>}
                          </div>
                          {/* Nombre de trésors (versets) de ce thème, à droite */}
                          {(() => {
                            const count = treasure.target_items?.length || treasure.target_references?.length || 0;
                            return (
                              <span className="h-5 px-1.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-[11px] shrink-0 whitespace-nowrap">
                                {count} trésor{count > 1 ? 's' : ''}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                      {renderTargetItems()}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-4">
            <span>Titres : <strong className="text-foreground">{showTitles ? 'Activés' : 'Masqués'}</strong></span>
          </div>
          <Button size="sm" onClick={onClose} className="rounded-full px-5 h-8 text-xs">Fermer</Button>
        </div>
      </div>
    </div>
  );
};

export default VerseTreasuresModal;