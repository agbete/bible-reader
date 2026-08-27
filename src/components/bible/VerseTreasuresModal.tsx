import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  BookMarked, 
  LayoutGrid, 
  List, 
  BookOpen, 
  Copy, 
  Check, 
  ArrowRight, 
  Loader2, 
  ExternalLink,
  Layers,
  Scroll
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookSearchSelect } from '@/components/bible/BookSearchSelect';
import { ChapterNavigator } from '@/components/bible/ChapterNavigator';
import { 
  DbBookItem, 
  DbVerseItem, 
  DbTreasureItem, 
  getDbVerseTreasures,
  getDbChapterVerses 
} from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';

<dyad-write path="src/components/bible/VerseTreasuresModal.tsx" description="Create full-featured 95vw by 95vh modal for verse references and treasures with matching header and display modes">
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  BookMarked, 
  LayoutGrid, 
  List, 
  BookOpen, 
  Copy, 
  Check, 
  ArrowRight, 
  Loader2, 
  ExternalLink,
  Layers,
  Scroll
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookSearchSelect } from '@/components/bible/BookSearchSelect';
import { ChapterNavigator } from '@/components/bible/ChapterNavigator';
import { 
  DbBookItem, 
  DbVerseItem, 
  DbTreasureItem, 
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
  currentVersion: string;
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
  currentVersion,
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

  const [treasures, setTreasures] = useState<DbTreasureItem[]>([]);
  const [loadingTreasures, setLoadingTreasures] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Sync state when selected verse changes or modal opens
  useEffect(() => {
    if (selectedVerse && isOpen) {
      setActiveBook(selectedVerse.book);
      setActiveChapter(selectedVerse.chapter);
      setActiveVerseNumber(selectedVerse.verse_number);
      setActiveVerseText(selectedVerse.text);
      setActiveReferenceCode(selectedVerse.reference_code);
    }
  }, [selectedVerse, isOpen]);

  // Load treasures whenever active verse reference changes
  useEffect(() => {
    if (!isOpen || !activeReferenceCode) return;

    let isMounted = true;
    setLoadingTreasures(true);

    getDbVerseTreasures(activeReferenceCode, 'fr', currentVersion)
      .then((res) => {
        if (isMounted) {
          setTreasures(res || []);
        }
      })
      .catch((err) => {
        console.error('[VerseTreasuresModal] Error loading treasures:', err);
        if (isMounted) {
          setTreasures([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingTreasures(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeReferenceCode, currentVersion]);

  if (!isOpen || !activeBook) return null;

  const handleCopy = (text: string, ref: string) => {
    navigator.clipboard.writeText(`« ${text} » — ${ref} (${currentVersion})`);
    setCopiedCode(ref);
    showSuccess("Passage copié dans le presse-papier !");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSelectBookFromHeader = async (book: DbBookItem, chapter: number) => {
    setActiveBook(book);
    setActiveChapter(chapter);
    setActiveVerseNumber(1);
    
    // Fetch first verse text
    try {
      const verses = await getDbChapterVerses(book.id, chapter, currentVersion);
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
      const verses = await getDbChapterVerses(activeBook.id, chapter, currentVersion);
      if (verses && verses.length > 0) {
        setActiveVerseText(verses[0].text);
        setActiveReferenceCode(verses[0].reference_code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totalTargetsCount = treasures.reduce(
    (acc, t) => acc + (t.target_items?.length || t.target_references?.length || 0), 
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      {/* Modal Container: 95vw by 95vh */}
      <div className="relative w-[95vw] h-[95vh] max-w-7xl bg-background rounded-3xl border border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER: Section de contrôle identique à la section 788 */}
        <div className="w-full bg-gray-50 dark:bg-gray-900/90 border-b border-border/80 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
            {/* BookSearchSelect */}
            <div className="flex-1 min-w-0">
              <BookSearchSelect
                booksList={booksList}
                selectedBook={activeBook}
                selectedChapter={activeChapter}
                onSelectBook={handleSelectBookFromHeader}
                currentVersion={currentVersion}
                testamentsList={testamentsList}
                classificationsList={classificationsList}
                testamentNames={testamentNames}
                classificationNames={classificationNames}
              />
            </div>

            {/* ChapterNavigator */}
            <div className="shrink-0">
              <ChapterNavigator
                selectedBook={activeBook}
                selectedChapter={activeChapter}
                booksList={booksList}
                onChapterChange={handleChapterChangeFromHeader}
                onBookChange={(b) => handleSelectBookFromHeader(b, 1)}
              />
            </div>

            {/* Actions: Titres, Compact/Liste, et bouton Fermer */}
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
                title={showTitles ? "Masquer les titres de section" : "Afficher les titres de section"}
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

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted ml-1"
                title="Fermer la fenêtre"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* BODY: Deux colonnes (Gauche: Verset Source sélectionné, Droite: Trésors & Références) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-background divide-y lg:divide-y-0 lg:divide-x divide-border">
          
          {/* Colonne Gauche: Verset Source (5 cols) */}
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto bg-muted/10 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold font-mono border border-amber-500/30">
                    {activeBook.name} {activeChapter}:{activeVerseNumber}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Version {currentVersion}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(activeVerseText, `${activeBook.name} ${activeChapter}:${activeVerseNumber}`)}
                  className="h-8 px-2.5 rounded-full text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedCode === `${activeBook.name} ${activeChapter}:${activeVerseNumber}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copier</span>
                </Button>
              </div>

              {/* Texte du verset source */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 shadow-xs">
                <blockquote className="text-lg sm:text-xl md:text-2xl font-serif leading-relaxed text-foreground tracking-wide">
                  « {activeVerseText || 'Sélectionnez un verset pour explorer ses richesses.'} »
                </blockquote>
                <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 font-semibold">
                  <span>{activeReferenceCode}</span>
                  <span className="font-sans text-[11px] text-muted-foreground font-normal">Verset source</span>
                </div>
              </div>

              {/* Récapitulatif Trésors */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Trésors & Liens Bibliques</span>
                    <span className="text-[11px] text-muted-foreground">
                      {treasures.length} groupe{treasures.length > 1 ? 's' : ''} thématique{treasures.length > 1 ? 's' : ''} • {totalTargetsCount} verset{totalTargetsCount > 1 ? 's' : ''} lié{totalTargetsCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onNavigateToPassage(activeBook, activeChapter);
                    onClose();
                  }}
                  className="h-8 rounded-full text-xs gap-1 hover:bg-amber-600 hover:text-white transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Lire tout le chapitre</span>
                </Button>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground italic text-center pt-4 border-t border-border/40">
              « Scrutez les Écritures... ce sont elles qui rendent témoignage » — Jean 5:39
            </div>
          </div>

          {/* Colonne Droite: Trésors & Références Croisées (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col overflow-hidden bg-background">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-bold text-base sm:text-lg tracking-tight">
                  Références Croisées & Trésors de la Parole
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {totalTargetsCount} passage{totalTargetsCount > 1 ? 's' : ''}
              </span>
            </div>

            {/* Contenu avec ascenseur indépendant */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {loadingTreasures ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                  <span className="text-sm font-medium">Recherche des trésors et versets croisés...</span>
                </div>
              ) : treasures.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground space-y-3">
                  <Scroll className="w-12 h-12 mx-auto text-muted-foreground/30 stroke-1" />
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">Aucune référence croisée répertoriée</p>
                    <p className="text-xs max-w-sm mx-auto">
                      Ce verset ne comporte pas encore de trésor enregistré dans la table Supabase `treasures` ou `cross_references`.
                    </p>
                  </div>
                </div>
              ) : (
                treasures.map((treasure, index) => (
                  <div 
                    key={treasure.treasure_id || index}
                    className="p-5 rounded-3xl border border-border bg-card/60 hover:bg-card hover:border-amber-500/40 transition-all shadow-xs space-y-3"
                  >
                    {/* Titre du thème / trésor (soumis à showTitles) */}
                    {showTitles && treasure.title && (
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold text-xs">
                            {index + 1}
                          </span>
                          <h4 className="font-bold text-sm text-foreground font-serif">
                            {treasure.title}
                          </h4>
                        </div>
                        {treasure.description && (
                          <span className="text-xs text-muted-foreground italic line-clamp-1">
                            {treasure.description}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Versets cibles selon displayMode (list par défaut ou compact) */}
                    {treasure.target_items && treasure.target_items.length > 0 ? (
                      displayMode === 'list' ? (
                        <div className="space-y-2.5">
                          {treasure.target_items.map((target, tIdx) => {
                            const matchedBook = booksList.find(
                              b => b.code.toLowerCase() === target.book_code.toLowerCase()
                            );

                            return (
                              <div
                                key={tIdx}
                                className="p-3 rounded-2xl bg-muted/30 hover:bg-amber-500/10 border border-border/60 transition-all group flex flex-col gap-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                                    {target.reference_code || `${target.book_code} ${target.chapter}:${target.verse_number}`}
                                  </span>

                                  <div className="flex items-center gap-1.5">
                                    {target.text && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopy(target.text || '', target.reference_code)}
                                        className="h-6 px-2 text-[11px] rounded-full"
                                      >
                                        {copiedCode === target.reference_code ? (
                                          <Check className="w-3 h-3 text-emerald-500 mr-1" />
                                        ) : (
                                          <Copy className="w-3 h-3 mr-1" />
                                        )}
                                        <span>Copier</span>
                                      </Button>
                                    )}

                                    {matchedBook && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          onNavigateToPassage(matchedBook, target.chapter);
                                          onClose();
                                        }}
                                        className="h-6 px-2.5 text-[11px] rounded-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                                      >
                                        <BookOpen className="w-3 h-3 mr-1" />
                                        <span>Ouvrir</span>
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <p className="font-serif text-xs sm:text-sm text-foreground leading-relaxed">
                                  {target.text ? `« ${target.text} »` : `[Référence : ${target.reference_code}]`}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Mode Compact */
                        <div className="font-serif text-sm leading-relaxed space-y-1">
                          {treasure.target_items.map((target, tIdx) => {
                            const matchedBook = booksList.find(
                              b => b.code.toLowerCase() === target.book_code.toLowerCase()
                            );

                            return (
                              <span 
                                key={tIdx} 
                                className="inline-block mr-3 p-1 rounded hover:bg-amber-500/15 transition-colors cursor-pointer"
                                onClick={() => {
                                  if (matchedBook) {
                                    onNavigateToPassage(matchedBook, target.chapter);
                                    onClose();
                                  }
                                }}
                              >
                                <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 mr-1.5">
                                  [{target.reference_code}]
                                </span>
                                <span className="text-foreground">
                                  {target.text || ''}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      /* Fallback liste de codes de références */
                      <div className="flex flex-wrap gap-2">
                        {treasure.target_references.map((refCode, rIdx) => (
                          <span
                            key={rIdx}
                            className="px-3 py-1.5 rounded-xl bg-muted font-mono text-xs font-bold text-amber-700 dark:text-amber-300 border border-border"
                          >
                            {refCode}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer modal */}
            <div className="pt-4 border-t border-border mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Mode actif : {displayMode === 'list' ? 'Liste détaillée' : 'Compact'}</span>
              <Button size="sm" onClick={onClose} className="rounded-full px-5 h-8 text-xs">
                Fermer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerseTreasuresModal;