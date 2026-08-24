import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Volume2, 
  VolumeX, 
  Bookmark, 
  BookmarkCheck, 
  Type, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check,
  Database,
  Loader2,
  Sparkles,
  Layers,
  X
} from 'lucide-react';
import { getDbChapterVerses, getDbVerseTreasures, DbVerseItem, DbTreasureItem } from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';

interface ReaderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  chapterNumber: number;
  currentVersion: string;
  selectedVersions?: string[];
  onChapterChange: (bookId: string, chapter: number) => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (verse: any) => void;
}

export const ReaderDialog: React.FC<ReaderDialogProps> = ({
  isOpen,
  onClose,
  bookId,
  chapterNumber,
  currentVersion,
  selectedVersions = ['LSG'],
  onChapterChange,
  isBookmarked,
  onToggleBookmark,
}) => {
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [readerTheme, setReaderTheme] = useState<'clean' | 'sepia' | 'dark'>('clean');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedVerse, setCopiedVerse] = useState<number | null>(null);
  const [verses, setVerses] = useState<DbVerseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersionForDisplay, setSelectedVersionForDisplay] = useState<string>('LSG');

  // State for multiple versions
  const [allVersionsVerses, setAllVersionsVerses] = useState<{ versionCode: string; verses: DbVerseItem[] }[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setSelectedVersionForDisplay(selectedVersions[0] || 'LSG');
    setAllVersionsVerses([]);

    // Load verses for the selected chapter from all available versions
    const loadVersesForChapter = async () => {
      const versionCodes = selectedVersions.length > 0 ? selectedVersions : ['LSG'];
      
      const loadVersesPromises = versionCodes.map(code =>
        getDbChapterVerses(bookId, chapterNumber, code)
      );

      try {
        const results = await Promise.all(loadVersesPromises);
        
        if (!isMounted) return;
        
        setAllVersionsVerses(results.map((verses, index) => ({
          versionCode: versionCodes[index],
          verses: verses
        })));
      } catch (err) {
        console.error(err);
        if (isMounted) setVerses([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadVersesForChapter();

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookId, chapterNumber, currentVersion, selectedVersions]);

  const handleOpenTreasures = async (v: DbVerseItem) => {
    // ... existing code
  };

  const chapterTitle = `${bookId} ${chapterNumber}`;

  const handleAudio = () => {
    // ... existing code
  };

  const handleCopyVerse = (verseNum: number, text: string, versionCode: string) => {
    // ... existing code
  };

  const nextChapter = () => {
    // ... existing code
  };

  const prevChapter = () => {
    // ... existing code
  };

  const getThemeClasses = () => {
    // ... existing code
  };

  const getFontSizeClass = () => {
    // ... existing code
  };

  // Get verses for display based on selected versions
  const displayedVerses = allVersionsVerses.length > 0 ? 
    allVersionsVerses.flatMap(v => v.verses) : 
    verses;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && isPlayingAudio && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      }
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-4xl max-h-[92vh] h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 rounded-3xl">
        {/* Barre d'outils supérieure */}
        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between gap-2 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs font-mono">
              {bookId}
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
                <span>{chapterTitle}</span>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Database className="w-3 h-3" /> Supabase ({displayedVerses.length} versets)
                </span>
              </DialogTitle>
              <span className="text-[11px] text-muted-foreground font-medium">
                Version : {selectedVersionForDisplay}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAudio}
              className={`h-8 px-2.5 rounded-full text-xs gap-1.5 ${
                isPlayingAudio ? 'bg-amber-500 text-stone-950 border-amber-500 font-semibold animate-pulse' : ''
              }`}
            >
              {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isPlayingAudio ? 'Pause' : 'Écouter'}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title="Ajuster la taille de police"
              onClick={() => {
                if (fontSize === 'normal') setFontSize('large');
                else if (fontSize === 'large') setFontSize('xlarge');
                else setFontSize('normal');
              }}
            >
              <Type className="w-4 h-4" />
            </Button>

            <div className="flex items-center bg-muted p-0.5 rounded-full border border-border">
              <button
                onClick={() => setReaderTheme('clean')}
                className={`w-6 h-6 rounded-full text-[10px] font-bold ${
                  readerTheme === 'clean' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
                title="Clair"
              >
                C
              </button>
              <button
                onClick={() => setReaderTheme('sepia')}
                className={`w-6 h-6 rounded-full text-[10px] font-bold bg-[#f4ebd0] text-[#5b4636] ${
                  readerTheme === 'sepia' ? 'ring-1 ring-amber-700' : ''
                }`}
                title="Sépia"
              >
                S
              </button>
              <button
                onClick={() => setReaderTheme('dark')}
                className={`w-6 h-6 rounded-full text-[10px] font-bold bg-zinc-900 text-zinc-100 ${
                  readerTheme === 'dark' ? 'ring-1 ring-zinc-500' : ''
                }`}
                title="Sombre"
              >
                N
              </button>
            </div>
          </div>
        </div>

        {/* Corps de lecture */}
        <div className="flex-1 flex overflow-hidden">
          <div className={`flex-1 overflow-y-auto px-6 sm:px-12 py-8 transition-colors ${getThemeClasses()}`}>
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center pb-6 border-b border-border/40">
                <span className="text-xs uppercase font-semibold tracking-widest text-amber-600 dark:text-amber-400">
                  Parole de Dieu
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold mt-1">
                  {chapterTitle}
                </h2>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  <span className="text-xs font-medium">Chargement des versets depuis Supabase...</span>
                </div>
              ) : displayedVerses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <p className="text-sm font-semibold">Aucun verset trouvé pour ce chapitre dans la version {selectedVersionForDisplay}.</p>
                  <p className="text-xs">Vérifiez que les tables `verses` et `verse_texts` contiennent les textes.</p>
                </div>
              ) : (
                <div className={`space-y-4 font-serif ${getFontSizeClass()}`}>
                  {displayedVerses.map((v) => {
                    const verseUniqueId = `${bookId}-${chapterNumber}-${v.verse_number}`;
                    const bookmarked = isBookmarked(verseUniqueId);

                    return (
                      <div
                        key={v.id || v.verse_number}
                        className={`group relative flex items-start gap-3 p-2.5 -mx-2 rounded-2xl transition-colors cursor-pointer ${
                          bookmarked 
                            ? 'bg-amber-500/15 border border-amber-500/30' 
                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        onClick={() => console.log('Verse clicked:', v.verse_number)}
                      >
                        <sup className="text-xs font-sans font-bold text-amber-600 dark:text-amber-400 pt-1 shrink-0 select-none">
                          {v.verse_number}
                        </sup>
                        <p className="flex-1 select-text leading-relaxed">
                          {v.text}
                        </p>

                        <div 
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 pt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => console.log('Open treasures for verse:', v.verse_number)}
                            className="p-1 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-muted"
                            title="Voir les références croisées / Trésors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleCopyVerse(v.verse_number, v.text, selectedVersionForDisplay)}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Copier le verset"
                          >
                            {copiedVerse === v.verse_number ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => onToggleBookmark({
                              id: verseUniqueId,
                              reference: `${bookId} ${chapterNumber}:${v.verse_number}`,
                              book: bookId,
                              chapter: chapterNumber,
                              verse: v.verse_number,
                              text: v.text,
                              translation: selectedVersionForDisplay
                            })}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                            title={bookmarked ? "Retirer des favoris" : "Ajouter aux favoris"}
                          >
                            {bookmarked ? (
                              <BookmarkCheck className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            ) : (
                              <Bookmark className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panneau latéral Trésors & Références Croisées */}
          {/* ... existing code ... */}
        </div>

        {/* Pied de footer de navigation */}
        {/* ... existing code ... */}
      </DialogContent>
    </Dialog>
  );
};