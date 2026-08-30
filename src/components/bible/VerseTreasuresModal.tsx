import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  BookMarked, 
  LayoutGrid, 
  List, 
  BookOpen, 
  Copy, 
  Check, 
  Loader2, 
  Link2,
  Gem,
  Scroll,
  ChevronDown,
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
  getDbChapterVerses 
} from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';

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
  displayMode: 'compact' | 'list';
  onToggleDisplayMode: () => void;
  onNavigateToPassage: (book: DbBookItem, chapter: number) => void;
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
  displayMode,
  onToggleDisplayMode,
  onNavigateToPassage
}) => {
  const [activeBook, setActiveBook] = useState<DbBookItem | null>(null);
  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [activeVerseNumber, setActiveVerseNumber] = useState<number>(1);
  const [activeVerseText, setActiveVerseText] = useState<string>('');
  const [activeReferenceCode, setActiveReferenceCode] = useState<string>('');

  const [crossReferences, setCrossReferences] = useState<DbCrossReferenceItem[]>([]);
  const [treasures, setTreasures] = useState<DbTreasureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Version selector state
  const [displayVersionCode, setDisplayVersionCode] = useState<string>('');
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const activeVersionRef = useRef<string>('');

  // Title language state
  const [titleLanguageId, setTitleLanguageId] = useState<number | null>(null);
  const [titleLanguageOptions, setTitleLanguageOptions] = useState<Array<{id:number, name:string}>>([]);
  const [titleLanguageDropdownOpen, setTitleLanguageDropdownOpen] = useState(false);
  const [selectedTreasureForLanguage, setSelectedTreasureForLanguage] = useState<number | null>(null);

  // Refs for click-outside detection
  const versionSelectRef = useRef<HTMLDivElement>(null);
  const titleSelectRef = useRef<HTMLDivElement>(null);

  // Track latest request to avoid stale responses
  const latestRequestRef = useRef<string>('');

  // Initialize display version from selectedVerse
  useEffect(() => {
    if (selectedVerse) {
      setDisplayVersionCode(selectedVerse.versionCode);
    }
  }, [selectedVerse]);

  // Sync state when selected verse changes or modal opens
  useEffect(() => {
    if (selectedVerse && isOpen) {
      setActiveBook(selectedVerse.book);
      setActiveChapter(selectedVerse.chapter);
      setActiveVerseNumber(selectedVerse.verse_number);
      setActiveVerseText(selectedVerse.text);
      setActiveReferenceCode(selectedVerse.reference_code);
      
      // Reset title language to version's language when version changes
      const versionObj = versions.find(v => v.code === selectedVerse.versionCode);
      const versionLanguageId = versionObj?.language_id ?? 2;
      setTitleLanguageId(versionLanguageId);
    }
  }, [selectedVerse, isOpen, versions]);

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
        
        // Log book names from API
        crossRes?.forEach((ref, idx) => {
          console.log(`[VerseTreasuresModal] CrossRef ${idx} book_name:`, ref.book_name);
        });
        
        treasuresRes?.forEach((treasure, tIdx) => {
          treasure.target_items?.forEach((target, tiIdx) => {
            console.log(`[VerseTreasuresModal] Treasure ${tIdx} target ${tiIdx} book_name:`, target.book_name);
          });
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

  // Click-outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionSelectRef.current && !versionSelectRef.current.contains(event.target as Node)) {
        setVersionDropdownOpen(false);
      }
      if (titleSelectRef.current && !titleSelectRef.current.contains(event.target as Node)) {
        setTitleLanguageDropdownOpen(false);
        setSelectedTreasureForLanguage(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !activeBook) return null;

  const activeDisplayRef = `${activeBook.name} ${activeChapter}:${activeVerseNumber}`;

  const handleCopy = (text: string, humanRef: string) => {
    navigator.clipboard.writeText(`« ${text} » — ${humanRef} (${displayVersionCode})`);
    setCopiedCode(humanRef);
    showSuccess("Passage copié dans le presse-papier ?");
    setTimeout(() => setCopiedCode(null), 2000);
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

  const handleVersionChange = (newVersion: string) => {
    console.log('[VerseTreasuresModal] Changing version from', displayVersionCode, 'to', newVersion);
    setDisplayVersionCode(newVersion);
    setVersionDropdownOpen(false);
  };

  const handleTitleLanguageChange = (languageId: number) => {
    setTitleLanguageId(languageId);
    setTitleLanguageDropdownOpen(false);
    // Reset selected treasure language when language changes globally
    setSelectedTreasureForLanguage(null);
  };

  const handleOpenTitleLanguageSelector = (treasureId: number) => {
    setSelectedTreasureForLanguage(treasureId);
    setTitleLanguageDropdownOpen(true);
  };

  const handleCloseTitleLanguageSelector = () => {
    setTitleLanguageDropdownOpen(false);
    setSelectedTreasureForLanguage(null);
  };

  // Helper to format "Livre Chapitre:Verset"
  const formatHumanReference = (bookCode: string, chapter: number, verseNum: number, fallbackBookName?: string): string => {
    // Priority 1: Use API-provided book name if it's different from the code
    // (This ensures the correct language is shown when version changes)
    if (fallbackBookName && fallbackBookName.toUpperCase() !== bookCode.toUpperCase()) {
      return `${fallbackBookName} ${chapter}:${verseNum}`;
    }
    
    // Priority 2: Check booksList for a matching book with a valid name
    const book = booksList.find(b => b.code.toLowerCase() === bookCode.toLowerCase());
    if (book && book.name.toUpperCase() !== bookCode.toUpperCase()) {
      return `${book.name} ${chapter}:${verseNum}`;
    }
    
    // Priority 3: Fallback to code if no translated name available
    return `${bookCode} ${chapter}:${verseNum}`;
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

  // Get language name from language_id
  const getLanguageName = (languageId: number): string => {
    const lang = titleLanguageOptions.find(opt => opt.id === languageId);
    return lang ? lang.name : `Langue ${languageId}`;
  };

  // Get English language ID for fallback
  const getEnglishLanguageId = (): number => {
    const englishVersion = versions.find(v => 
      v.code.toLowerCase() === 'en' || 
      v.name.toLowerCase().includes('english')
    );
    return englishVersion?.language_id ?? 4; // fallback to 4 if not found
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="relative w-[95vw] h-[95vh] max-w-7xl bg-background rounded-3xl border border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="w-full bg-gray-50 dark:bg-gray-900/90 border-b border-border/80 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
            <div className="flex-1 min-w-0">
              <BookSearchSelect
                booksList={booksList}
                selectedBook={activeBook}
                selectedChapter={activeChapter}
                onSelectBook={handleSelectBookFromHeader}
                currentVersion={displayVersionCode}
                testamentsList={testamentsList}
                classificationsList={classificationsList}
                testamentNames={testamentNames}
                classificationNames={classificationNames}
              />
            </div>

            <div className="shrink-0">
              <ChapterNavigator
                selectedBook={activeBook}
                selectedChapter={activeChapter}
                booksList={booksList}
                onChapterChange={handleChapterChangeFromHeader}
                onBookChange={(b) => handleSelectBookFromHeader(b, 1)}
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0 border-t xl:border-t-0 xl:border-l border-border pt-2 xl:pt-0 xl:pl-3">
              <Button
                variant={showTitles ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleShowTitles}
                className={`h-9 px-3 rounded-full text-xs gap-1.5 font-medium transition-all ${
                  showTitles 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BookMarked className={`w-3.5 h-3.5 ${showTitles ? 'fill-white' : ''}`} />
                <span>Titres</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onToggleDisplayMode}
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

              {/* VERSION SELECTOR */}
              <div className="relative" ref={versionSelectRef}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setVersionDropdownOpen(!versionDropdownOpen);
                  }}
                  className="h-9 px-3 rounded-full text-xs gap-1.5 font-medium transition-all border border-border flex items-center gap-1.5 cursor-pointer hover:bg-muted/50"
                >
                  <span>Version {displayVersionCode.toUpperCase()}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${versionDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {versionDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-32 bg-card border border-border rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                    {versions.map(v => (
                      <button
                        key={v.code}
                        onClick={() => {
                          setDisplayVersionCode(v.code);
                          setVersionDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm font-mono transition-colors ${
                          v.code === displayVersionCode
                            ? 'bg-amber-500/15 text-amber-700 font-semibold'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <span className="font-mono">{v.code.toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground truncate ml-2">{v.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted ml-1"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* BANDEAU VERSET SOURCE */}
        <div className="w-full bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-500/20 px-4 sm:px-6 py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
            <span className="px-3 py-1 rounded-full bg-amber-600 text-white text-xs font-bold font-serif shrink-0 shadow-xs">
              {activeDisplayRef}
            </span>
            <blockquote className="font-serif text-xs sm:text-sm text-foreground italic leading-relaxed line-clamp-2 md:line-clamp-1">
              « {activeVerseText || 'Sélectionnez un verset...'} »
            </blockquote>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <span className="text-[11px] text-muted-foreground font-medium">
              Langue: {versions.find(v => v.code === displayVersionCode)?.language_id === 1 ? 'Goun' : 
                       versions.find(v => v.code === displayVersionCode)?.language_id === 3 ? 'Français' :
                       versions.find(v => v.code === displayVersionCode)?.language_id === 5 ? 'Fon' :
                       'Version ' + displayVersionCode}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(activeVerseText, activeDisplayRef)}
              className="h-7 px-2.5 rounded-full text-xs gap-1"
            >
              {copiedCode === activeDisplayRef ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>Copier verset</span>
            </Button>
            <Button
              size="sm"
              onClick={() => { onNavigateToPassage(activeBook, activeChapter); onClose(); }}
              className="h-7 px-3 rounded-full text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <BookOpen className="w-3 h-3 mr-1" />
              <span>Ouvrir chapitre</span>
            </Button>
          </div>
        </div>

        {/* BODY: TWO COLUMNS */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-background divide-y lg:divide-y-0 lg:divide-x divide-border">
          
          {/* COLONNE 1: RÉFÉRENCES CROISÉES */}
          <div className="p-4 sm:p-6 flex flex-col overflow-hidden bg-muted/5">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight text-foreground">Références Croisées</h3>
                  <span className="text-[10px] text-muted-foreground">Passages bibliques parallèles</span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-serif">
                {crossReferences.length} réf{crossReferences.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
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
              ) : displayMode === 'list' ? (
                crossReferences.map((refItem) => {
                  const matchedBook = booksList.find(b => b.code.toLowerCase() === refItem.book_code.toLowerCase());
                  const humanRef = formatHumanReference(refItem.book_code, refItem.chapter, refItem.verse_number, refItem.book_name);

                  return (
                    <div key={refItem.id} className="p-3.5 rounded-2xl bg-card border border-border/80 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group flex flex-col gap-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-xs text-blue-700 dark:text-blue-300">{humanRef}</span>
                        <div className="flex items-center gap-1.5">
                          {refItem.text && (
                            <Button variant="ghost" size="sm" onClick={() => handleCopy(refItem.text || '', humanRef)} className="h-6 px-2 text-[11px] rounded-full">
                              {copiedCode === humanRef ? <Check className="w-3 h-3 text-emerald-500 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                              <span>Copier</span>
                            </Button>
                          )}
                          {matchedBook && (
                            <Button size="sm" onClick={() => { onNavigateToPassage(matchedBook, refItem.chapter); onClose(); }} className="h-6 px-2.5 text-[11px] rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium">
                              <BookOpen className="w-3 h-3 mr-1" /><span>Ouvrir</span>
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="font-serif text-xs sm:text-sm text-foreground leading-relaxed">
                        {refItem.text ? `« ${refItem.text} »` : `[Texte non disponible]`}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-2xl bg-card border border-border font-serif text-sm leading-relaxed space-y-2">
                  {crossReferences.map((refItem) => {
                    const matchedBook = booksList.find(b => b.code.toLowerCase() === refItem.book_code.toLowerCase());
                    const humanRef = formatHumanReference(refItem.book_code, refItem.chapter, refItem.verse_number, refItem.book_name);
                    return (
                      <span key={refItem.id} onClick={() => { if (matchedBook) { onNavigateToPassage(matchedBook, refItem.chapter); onClose(); } }} className="inline-block mr-3 p-1 rounded hover:bg-blue-500/15 cursor-pointer transition-colors">
                        <span className="font-serif font-bold text-xs text-blue-600 dark:text-blue-400 mr-1">[{humanRef}]</span>
                        <span className="text-foreground">{refItem.text || ''}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLONNE 2: TRÉSORS */}
          <div className="p-4 sm:p-6 flex flex-col overflow-hidden bg-background">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Gem className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight text-foreground">Trésors de l'Écriture</h3>
                  <span className="text-[10px] text-muted-foreground">Thèmes d'étude & trésors spirituels</span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-serif">
                {treasures.length} thème{treasures.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3.5">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  <span className="text-xs">Chargement... (version: {displayVersionCode})</span>
                </div>
              ) : treasures.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Gem className="w-10 h-10 mx-auto text-muted-foreground/30 stroke-1" />
                  <p className="text-sm font-semibold">Aucun trésor répertorié</p>
                  <p className="text-xs">Version: {displayVersionCode}</p>
                </div>
              ) : (
                treasures.map((treasure, index) => (
                  <div key={treasure.treasure_id || index} className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-amber-500/40 transition-all shadow-xs space-y-3">
                    {showTitles && (
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-[11px]">{index + 1}</span>
                          <h4 className="font-bold text-xs sm:text-sm text-foreground font-serif">{treasure.title}</h4>
                        </div>
                        {treasure.description && <span className="text-[11px] text-muted-foreground italic line-clamp-1">{treasure.description}</span>}
                      </div>
                    )}

                    {treasure.target_items && treasure.target_items.length > 0 ? (
                      displayMode === 'list' ? (
                        <div className="space-y-2">
                          {treasure.target_items.map((target, tIdx) => {
                            const matchedBook = booksList.find(b => b.code.toLowerCase() === target.book_code.toLowerCase());
                            const humanRef = formatHumanReference(target.book_code, target.chapter, target.verse_number, target.book_name);

                            return (
                              <div key={tIdx} className="p-3 rounded-xl bg-muted/30 hover:bg-amber-500/10 border border-border/60 transition-all flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-serif font-bold text-xs text-amber-600 dark:text-amber-400">{humanRef}</span>
                                  <div className="flex items-center gap-1">
                                    {target.text && (
                                      <Button variant="ghost" size="sm" onClick={() => handleCopy(target.text || '', humanRef)} className="h-6 px-2 text-[10px] rounded-full">
                                        {copiedCode === humanRef ? <Check className="w-3 h-3 text-emerald-500 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                        <span>Copier</span>
                                      </Button>
                                    )}
                                    {matchedBook && (
                                      <Button size="sm" onClick={() => { onNavigateToPassage(matchedBook, target.chapter); onClose(); }} className="h-6 px-2 text-[10px] rounded-full bg-amber-600 hover:bg-amber-700 text-white font-medium">
                                        <BookOpen className="w-3 h-3 mr-1" /><span>Ouvrir</span>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <p className="font-serif text-xs text-foreground leading-relaxed">{target.text ? `« ${target.text} »` : `[${humanRef}]`}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Display mode compact
                        <div className="font-serif text-xs leading-relaxed space-y-1">
                          {treasure.target_items.map((target, tIdx) => {
                            const matchedBook = booksList.find(b => b.code.toLowerCase() === target.book_code.toLowerCase());
                            const humanRef = formatHumanReference(target.book_code, target.chapter, target.verse_number, target.book_name);
                            return (
                              <span key={tIdx} onClick={() => { if (matchedBook) { onNavigateToPassage(matchedBook, target.chapter); onClose(); } }} className="inline-block mr-2 p-1 rounded hover:bg-amber-500/15 cursor-pointer transition-colors">
                                <span className="font-serif font-bold text-xs text-amber-600 dark:text-amber-400 mr-1">[{humanRef}]</span>
                                <span className="text-foreground">{target.text || ''}</span>
                              </span>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      // No targets
                      <div className="flex flex-wrap gap-1.5">
                        {treasure.target_references.map((refCode, rIdx) => (
                          <span key={rIdx} className="px-2 py-1 rounded-lg bg-muted font-serif text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-border">
                            {parseRefCodeToHuman(refCode)}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Handle missing title */}
                    {showTitles && (!treasure.title || treasure.title.trim() === '') && (
                      <div className="p-3 mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
                        <div className="flex items-center justify-between space-x-2">
                          <div>
                            <span className="font-semibold text-xs text-amber-800 dark:text-amber-200">
                              Titre non disponible en {getLanguageName(titleLanguageId ?? (versions.find(v => v.code === displayVersionCode)?.language_id ?? 2))}
                            </span>
                          </div>
                          <div>
                            {/* Button to change language for this treasure */}
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenTitleLanguageSelector(treasure.treasure_id ?? index)}
                              className="h-6 px-2 text-[10px] rounded-full"
                            >
                              <span className="font-mono text-xs">Changer</span>
                            </Button>
                          </div>
                        </div>
                        
                        {/* Language selector popup */}
                        {selectedTreasureForLanguage === (treasure.treasure_id ?? index) && titleLanguageDropdownOpen && (
                          <div className="absolute z-20 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg p-2">
                            <div className="mb-2 text-xs font-semibold text-foreground">
                              Afficher les titres dans :
                            </div>
                            <div className="space-y-1">
                              {titleLanguageOptions.map(opt => (
                                <button
                                  key={opt.id}
                                  onClick={() => {
                                    handleTitleLanguageChange(opt.id);
                                    handleCloseTitleLanguageSelector();
                                  }}
                                  className={`w-full text-left px-2 py-1.5 text-sm font-mono transition-colors ${
                                    opt.id === titleLanguageId
                                      ? 'bg-amber-500/15 text-amber-700'
                                      : 'hover:bg-muted/40'
                                  }`}
                                >
                                  {opt.name}
                                </button>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={handleCloseTitleLanguageSelector}
                              className="w-full mt-2 px-2 py-1.5 text-xs rounded-full"
                            >
                              Annuler
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-4">
            <span>Mode : <strong className="text-foreground capitalize">{displayMode === 'list' ? 'Liste' : 'Compact'}</strong></span>
            <span>Titres : <strong className="text-foreground">{showTitles ? 'Activés' : 'Masqués'}</strong></span>
          </div>
          <Button size="sm" onClick={onClose} className="rounded-full px-5 h-8 text-xs">Fermer</Button>
        </div>
      </div>
    </div>
  );
};

export default VerseTreasuresModal;