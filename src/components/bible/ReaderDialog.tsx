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
  Loader2
} from 'lucide-react';
import { SAMPLE_CHAPTER_TEXTS, BIBLE_BOOKS, BibleVerseItem } from '@/data/bibleData';
import { getDbChapterVerses } from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';

interface ReaderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  chapterNumber: number;
  currentVersion: string;
  onChapterChange: (bookId: string, chapter: number) => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (verse: BibleVerseItem) => void;
}

export const ReaderDialog: React.FC<ReaderDialogProps> = ({
  isOpen,
  onClose,
  bookId,
  chapterNumber,
  currentVersion,
  onChapterChange,
  isBookmarked,
  onToggleBookmark,
}) => {
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [readerTheme, setReaderTheme] = useState<'clean' | 'sepia' | 'dark'>('clean');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedVerse, setCopiedVerse] = useState<number | null>(null);
  const [dbVerses, setDbVerses] = useState<{ num: number; text: string }[] | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);

  const book = BIBLE_BOOKS.find(b => b.id === bookId) || BIBLE_BOOKS[0];
  const chapterKey = `${bookId}-${chapterNumber}`;

  // Fetch from Supabase if dialog opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingDb(true);

    getDbChapterVerses(book.abbr || bookId, chapterNumber, currentVersion)
      .then(verses => {
        if (!isMounted) return;
        if (verses && verses.length > 0) {
          setDbVerses(verses);
        } else {
          setDbVerses(null);
        }
      })
      .catch(() => {
        if (isMounted) setDbVerses(null);
      })
      .finally(() => {
        if (isMounted) setLoadingDb(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookId, chapterNumber, currentVersion, book.abbr]);

  // Fallback verses if not in local sample or Supabase
  const fallbackVerses = SAMPLE_CHAPTER_TEXTS[chapterKey]?.verses || Array.from({ length: 10 }, (_, i) => ({
    num: i + 1,
    text: `Car l’Éternel est bon et sa miséricorde dure à toujours. Recommandez à Dieu toutes vos voies, car Il est la lumière de vos pas et le refuge au jour de détresse (Verset ${i + 1}).`
  }));

  const versesToRender = dbVerses && dbVerses.length > 0 ? dbVerses : fallbackVerses;
  const chapterTitle = SAMPLE_CHAPTER_TEXTS[chapterKey]?.title || `${book.name} ${chapterNumber}`;

  const handleAudio = () => {
    if (!('speechSynthesis' in window)) {
      showSuccess("La synthèse vocale n'est pas supportée.");
      return;
    }
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const allText = `${chapterTitle}. ` + versesToRender.map(v => `${v.num}. ${v.text}`).join(' ');
      const utterance = new SpeechSynthesisUtterance(allText);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.92;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  const handleCopyVerse = (verseNum: number, text: string) => {
    navigator.clipboard.writeText(`"${text}" — ${book.name} ${chapterNumber}:${verseNum} (${currentVersion})`);
    setCopiedVerse(verseNum);
    showSuccess(`Verset ${verseNum} copié !`);
    setTimeout(() => setCopiedVerse(null), 2000);
  };

  const nextChapter = () => {
    if (isPlayingAudio && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
    if (chapterNumber < book.chaptersCount) {
      onChapterChange(bookId, chapterNumber + 1);
    }
  };

  const prevChapter = () => {
    if (isPlayingAudio && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
    if (chapterNumber > 1) {
      onChapterChange(bookId, chapterNumber - 1);
    }
  };

  const getThemeClasses = () => {
    switch (readerTheme) {
      case 'sepia':
        return 'bg-[#fbf0d9] text-[#433422] border-amber-900/10';
      case 'dark':
        return 'bg-[#18181b] text-[#f4f4f5] border-zinc-800';
      default:
        return 'bg-background text-foreground';
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'large':
        return 'text-lg sm:text-xl leading-relaxed';
      case 'xlarge':
        return 'text-xl sm:text-2xl leading-loose';
      default:
        return 'text-base sm:text-lg leading-relaxed';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && isPlayingAudio && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      }
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-3xl max-h-[92vh] h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 rounded-3xl">
        {/* Top bar control toolbar */}
        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between gap-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
              {book.abbr}
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
                <span>{book.name} {chapterNumber}</span>
                {dbVerses && dbVerses.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Database className="w-3 h-3" /> Supabase
                  </span>
                )}
              </DialogTitle>
              <span className="text-[11px] text-muted-foreground font-medium">
                Version : {currentVersion}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Toggle */}
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

            {/* Font size toggle */}
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

            {/* Reading theme */}
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

        {/* Scrollable Reading Content */}
        <div className={`flex-1 overflow-y-auto px-6 sm:px-12 py-8 transition-colors ${getThemeClasses()}`}>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center pb-6 border-b border-border/40">
              <span className="text-xs uppercase font-semibold tracking-widest text-amber-600 dark:text-amber-400">
                {book.category}
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold mt-1">
                {chapterTitle}
              </h2>
            </div>

            {loadingDb ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                <span className="text-xs">Chargement des écritures...</span>
              </div>
            ) : (
              <div className={`space-y-4 font-serif ${getFontSizeClass()}`}>
                {versesToRender.map((v) => {
                  const verseUniqueId = `${bookId}-${chapterNumber}-${v.num}`;
                  const bookmarked = isBookmarked(verseUniqueId);

                  return (
                    <div
                      key={v.num}
                      className="group relative flex items-start gap-3 p-2 -mx-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <sup className="text-xs font-sans font-bold text-amber-600 dark:text-amber-400 pt-1 shrink-0 select-none">
                        {v.num}
                      </sup>
                      <p className="flex-1 select-text">
                        {v.text}
                      </p>

                      {/* Verse quick actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          onClick={() => handleCopyVerse(v.num, v.text)}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Copier le verset"
                        >
                          {copiedVerse === v.num ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => onToggleBookmark({
                            id: verseUniqueId,
                            reference: `${book.name} ${chapterNumber}:${v.num}`,
                            book: book.name,
                            chapter: chapterNumber,
                            verse: v.num,
                            text: v.text,
                            translation: currentVersion
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

        {/* Bottom Navigation footer */}
        <div className="px-6 py-3 border-t border-border/80 flex items-center justify-between bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            disabled={chapterNumber <= 1}
            onClick={prevChapter}
            className="h-9 px-3 rounded-full text-xs gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Chapitre précédent</span>
          </Button>

          <span className="text-xs font-semibold text-muted-foreground">
            {chapterNumber} / {book.chaptersCount}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={chapterNumber >= book.chaptersCount}
            onClick={nextChapter}
            className="h-9 px-3 rounded-full text-xs gap-1"
          >
            <span>Chapitre suivant</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};