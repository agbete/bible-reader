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
  Loader2, 
  Link2,
  Gem,
  Bookmark
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

  const [crossReferences, setCrossReferences] = useState<DbCrossReferenceItem[]>([]);
  const [treasures, setTreasures] = useState<DbTreasureItem[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Load both cross references AND treasures in parallel whenever reference code changes
  useEffect(() => {
    if (!isOpen || !activeReferenceCode) return;

    let isMounted = true;
    setLoading(true);

    Promise.all([
      getDbVerseCrossReferences(activeReferenceCode, currentVersion),
      getDbVerseTreasures(activeReferenceCode, 'fr', currentVersion)
    ])
      .then(([crossRes, treasuresRes]) => {
        if (isMounted) {
          setCrossReferences(crossRes || []);
          setTreasures(treasuresRes || []);
        }
      })
      .catch((err) => {
        console.error('[VerseTreasuresModal] Error loading references/treasures:', err);
        if (isMounted) {
          setCrossReferences([]);
          setTreasures([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      {/* Modal Container: 95vw by 95vh */}
      <div className="relative w-[95vw] h-[95vh] max-w-7xl bg-background rounded-3xl border border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* 1. HEADER: Section de contrôle identique à la section 788 */}
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

        {/* 2. BANDEAU VERSET SOURCE: Juste après le header */}
        <div className="w-full bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-500/20 px-4 sm:px-6 py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
            <span className="px-3 py-1 rounded-full bg-amber-600 text-white text-xs font-bold font-mono shrink-0 shadow-xs">
              {activeBook.name} {activeChapter}:{activeVerseNumber}
            </span>
            <blockquote className="font-serif text-xs sm:text-sm text-foreground italic leading-relaxed line-clamp-2 md:line-clamp-1">
              « {activeVerseText || 'Sélectionnez un verset pour explorer ses richesses.'} »
            </blockquote>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <span className="text-[11px] text-muted-foreground font-medium">
              Version {currentVersion}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(activeVerseText, `${activeBook.name} ${activeChapter}:{activeVerseNumber}`)}
              className="h-7 px-2.5 rounded-full text-xs gap-1"
            >
              {copiedCode === `${activeBook.name} ${activeChapter}:${activeVerseNumber}` ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>Copier verset</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onNavigateToPassage(activeBook, activeChapter);
                onClose();
              }}
              className="h-7 px-3 rounded-full text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <BookOpen className="w-3 h-3" />
              <span>Ouvrir chapitre</span>
            </Button>
          </div>
        </div>

        {/* 3. BODY: DEUX COLONNES (Gauche: Références Croisées, Droite: Trésors) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-background divide-y lg:divide-y-0 lg:divide-x divide-border">
          
          {/* COLONNE 1 : RÉFÉRENCES CROISÉES (cross_references) */}
          <div className="p-4 sm:p-6 flex flex-col overflow-hidden bg-muted/5">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight text-foreground">
                    Références Croisées
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    Passages bibliques parallèles et citations directes
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
                {crossReferences.length} référence{crossReferences.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Contenu ascenseur Références */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs">Chargement des références croisées...</span>
                </div>
              ) : crossReferences.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Link2 className="w-10 h-10 mx-auto text-muted-foreground/30 stroke-1" />
                  <p className="text-sm font-semibold">Aucune référence croisée directe</p>
                  <p className="text-xs">Aucun lien direct trouvé dans la table `cross_references` pour ce verset.</p>
                </div>
              ) : displayMode === 'list' ? (
                /* Mode Liste : Ligne par ligne */
                crossReferences.map((refItem) => {
                  const matchedBook = booksList.find(
                    b => b.code.toLowerCase() === refItem.book_code.toLowerCase()
                  );

                  return (
                    <div
                      key={refItem.id}
                      className="p-3.5 rounded-2xl bg-card border border-border/80 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group flex flex-col gap-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300">
                          {refItem.reference_code || `${refItem.book_code} ${refItem.chapter}:${refItem.verse_number}`}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {refItem.text && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(refItem.text || '', refItem.reference_code)}
                              className="h-6 px-2 text-[11px] rounded-full"
                            >
                              {copiedCode === refItem.reference_code ? (
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
                                onNavigateToPassage(matchedBook, refItem.chapter);
                                onClose();
                              }}
                              className="h-6 px-2.5 text-[11px] rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                            >
                              <BookOpen className="w-3 h-3 mr-1" />
                              <span>Ouvrir</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      <p className="font-serif text-xs sm:text-sm text-foreground leading-relaxed">
                        {refItem.text ? `« ${refItem.text} »` : `[Texte non disponible - ${refItem.reference_code}]`}
                      </p>
                    </div>
                  );
                })
              ) : (
                /* Mode Compact : Versets en continu */
                <div className="p-4 rounded-2xl bg-card border border-border font-serif text-sm leading-relaxed space-y-2">
                  {crossReferences.map((refItem) => {
                    const matchedBook = booksList.find(
                      b => b.code.toLowerCase() === refItem.book_code.toLowerCase()
                    );

                    return (
                      <span
                        key={refItem.id}
                        onClick={() => {
                          if (matchedBook) {
                            onNavigateToPassage(matchedBook, refItem.chapter);
                            onClose();
                          }
                        }}
                        className="inline-block mr-3 p-1 rounded hover:bg-blue-500/15 cursor-pointer transition-colors"
                      >
                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 mr-1">
                          [{refItem.reference_code}]
                        </span>
                        <span className="text-foreground">{refItem.text || ''}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLONNE 2 : TRÉSORS DE L'ÉCRITURE (treasures, treasure_translations, treasure_verses) */}
          <div className="p-4 sm:p-6 flex flex-col overflow-hidden bg-background">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Gem className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight text-foreground">
                    Trésors de l'Écriture
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    Thèmes d'étude, chaînes doctrinales & trésors spirituels
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
                {treasures.length} thème{treasures.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Contenu ascenseur Trésors */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3.5">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  <span className="text-xs">Chargement des trésors spirituels...</span>
                </div>
              ) : treasures.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Gem className="w-10 h-10 mx-auto text-muted-foreground/30 stroke-1" />
                  <p className="text-sm font-semibold">Aucun trésor répertorié</p>
                  <p className="text-xs">Aucun groupe thématique trouvé dans la table `treasures` pour ce verset.</p>
                </div>
              ) : (
                treasures.map((treasure, index) => (
                  <div
                    key={treasure.treasure_id || index}
                    className="p-4 sm:p-5 rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-amber-500/40 transition-all shadow-xs space-y-3"
                  >
                    {/* Titre et description du trésor (soumis au mode showTitles) */}
                    {showTitles && (
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-[11px]">
                            {index + 1}
                          </span>
                          <h4 className="font-bold text-xs sm:text-sm text-foreground font-serif">
                            {treasure.title}
                          </h4>
                        </div>
                        {treasure.description && (
                          <span className="text-[11px] text-muted-foreground italic line-clamp-1">
                            {treasure.description}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Versets associés au trésor */}
                    {treasure.target_items && treasure.target_items.length > 0 ? (
                      displayMode === 'list' ? (
                        <div className="space-y-2">
                          {treasure.target_items.map((target, tIdx) => {
                            const matchedBook = booksList.find(
                              b => b.code.toLowerCase() === target.book_code.toLowerCase()
                            );

                            return (
                              <div
                                key={tIdx}
                                className="p-3 rounded-xl bg-muted/30 hover:bg-amber-500/10 border border-border/60 transition-all flex flex-col gap-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                                    {target.reference_code || `${target.book_code} ${target.chapter}:${target.verse_number}`}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {target.text && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopy(target.text || '', target.reference_code)}
                                        className="h-6 px-2 text-[10px] rounded-full"
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
                                        className="h-6 px-2 text-[10px] rounded-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                                      >
                                        <BookOpen className="w-3 h-3 mr-1" />
                                        <span>Ouvrir</span>
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <p className="font-serif text-xs text-foreground leading-relaxed">
                                  {target.text ? `« ${target.text} »` : `[${target.reference_code}]`}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Mode compact */
                        <div className="font-serif text-xs leading-relaxed space-y-1">
                          {treasure.target_items.map((target, tIdx) => {
                            const matchedBook = booksList.find(
                              b => b.code.toLowerCase() === target.book_code.toLowerCase()
                            );

                            return (
                              <span
                                key={tIdx}
                                onClick={() => {
                                  if (matchedBook) {
                                    onNavigateToPassage(matchedBook, target.chapter);
                                    onClose();
                                  }
                                }}
                                className="inline-block mr-2 p-1 rounded hover:bg-amber-500/15 cursor-pointer transition-colors"
                              >
                                <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 mr-1">
                                  [{target.reference_code}]
                                </span>
                                <span className="text-foreground">{target.text || ''}</span>
                              </span>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {treasure.target_references.map((refCode, rIdx) => (
                          <span
                            key={rIdx}
                            className="px-2 py-1 rounded-lg bg-muted font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-border"
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
          </div>
        </div>

        {/* 4. FOOTER DU MODAL */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-4">
            <span>Mode : <strong className="text-foreground capitalize">{displayMode}</strong></span>
            <span>Titres : <strong className="text-foreground">{showTitles ? 'Activés' : 'Masqués'}</strong></span>
          </div>
          <Button size="sm" onClick={onClose} className="rounded-full px-5 h-8 text-xs">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerseTreasuresModal;