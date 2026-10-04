import React, { useState } from 'react';
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Bookmark, 
  BookmarkCheck, 
  Share2, 
  Copy, 
  Check, 
  BookOpen,
  ArrowRight,
  Heart,
  Shuffle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DAILY_VERSIONS, DAILY_VERSES, BibleVerseItem } from '@/data/bibleData';
import { showSuccess } from '@/utils/toast';

interface DailyVerseCardProps {
  currentVersion: string;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (verse: BibleVerseItem) => void;
  onReadChapter: (bookId: string, chapter: number) => void;
}

export const DailyVerseCard: React.FC<DailyVerseCardProps> = ({
  currentVersion,
  isBookmarked,
  onToggleBookmark,
  onReadChapter
}) => {
  const [verseIndex, setVerseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [likesCount, setLikesCount] = useState(148);
  const [hasLiked, setHasLiked] = useState(false);

  const verse = DAILY_VERSES[verseIndex];
  const bookmarked = isBookmarked(verse.id);

  const handleNextVerse = () => {
    setVerseIndex((prev) => (prev + 1) % DAILY_VERSES.length);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${verse.text}" — ${verse.reference} (${currentVersion})`);
    setCopied(true);
    showSuccess("Verset copié dans le presse-papier !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAudioToggle = () => {
    if (!('speechSynthesis' in window)) {
      showSuccess("La synthèse vocale n'est pas supportée par votre navigateur.");
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${verse.reference}. ${verse.text}`);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  const handleLike = () => {
    if (hasLiked) {
      setLikesCount(prev => prev - 1);
      setHasLiked(false);
    } else {
      setLikesCount(prev => prev + 1);
      setHasLiked(true);
      showSuccess("Verset aimé !");
    }
  };

  const mapBookToId = (bookName: string): string => {
    const map: Record<string, string> = {
      'Ésaïe': 'esa',
      'Jean': 'jea',
      'Philippiens': 'phi',
      'Psaumes': 'psa',
      'Matthieu': 'mat'
    };
    return map[bookName] || 'psa';
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-900 via-amber-950 to-stone-900 text-amber-50 p-6 sm:p-8 md:p-10 shadow-xl border border-amber-800/40">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-yellow-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Tag and Buttons */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin-slow" />
            Verset du jour
          </span>
          <span className="text-xs text-amber-200/70 font-medium">
            Version {currentVersion}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextVerse}
            className="h-8 px-2 text-xs text-amber-200/80 hover:text-white hover:bg-amber-800/40 rounded-full"
            title="Découvrir un autre verset"
          >
            <Shuffle className="w-3.5 h-3.5 mr-1" />
            Autre
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleAudioToggle}
            className={`h-8 w-8 rounded-full text-amber-200/80 hover:text-white hover:bg-amber-800/40 ${
              isPlaying ? 'bg-amber-500 text-stone-950 hover:bg-amber-400 animate-pulse' : ''
            }`}
            title={isPlaying ? "Arrêter la lecture audio" : "Écouter le verset"}
          >
            {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleBookmark(verse)}
            className="h-8 w-8 rounded-full text-amber-200/80 hover:text-white hover:bg-amber-800/40"
            title={bookmarked ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            {bookmarked ? (
              <BookmarkCheck className="w-4 h-4 text-amber-400 fill-amber-400" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8 rounded-full text-amber-200/80 hover:text-white hover:bg-amber-800/40"
            title="Copier le verset"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Main Verse Typography */}
      <div className="relative z-10 my-4">
        <blockquote className="text-xl sm:text-2xl md:text-3xl font-serif font-medium leading-relaxed tracking-wide text-amber-50 drop-shadow-sm">
          « {verse.text} »
        </blockquote>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm sm:text-base font-semibold tracking-wide text-amber-300">
            {verse.reference}
          </div>
          
          <button 
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
              hasLiked 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                : 'text-amber-200/70 hover:text-rose-300'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-400 text-rose-400' : ''}`} />
            <span>{likesCount}</span>
          </button>
        </div>
      </div>

      {/* Reflection Note & Call to Read Chapter */}
      {verse.reflection && (
        <div className="relative z-10 mt-6 pt-5 border-t border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-amber-200/80 italic">
            💡 {verse.reflection}
          </p>

          <Button
            size="sm"
            onClick={() => onReadChapter(mapBookToId(verse.book), verse.chapter)}
            className="h-9 px-4 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs shadow-md shrink-0 flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Lire {verse.book} {verse.chapter}</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};