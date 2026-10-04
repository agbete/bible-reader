import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Hash,
  ChevronDown,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DbBookItem } from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';

interface ChapterNavigatorProps {
  selectedBook: DbBookItem | null;
  selectedChapter: number;
  booksList: DbBookItem[];
  onChapterChange: (chapter: number) => void;
  onBookChange: (book: DbBookItem) => void;
}

export const ChapterNavigator: React.FC<ChapterNavigatorProps> = ({
  selectedBook,
  selectedChapter,
  booksList,
  onChapterChange,
  onBookChange
}) => {
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const [chapterInput, setChapterInput] = useState('');

  if (!selectedBook) return null;

  // Get current book index
  const currentBookIndex = booksList.findIndex(b => b.id === selectedBook.id);
  
  // Previous / Next book
  const prevBook = currentBookIndex > 0 ? booksList[currentBookIndex - 1] : null;
  const nextBook = currentBookIndex < booksList.length - 1 ? booksList[currentBookIndex + 1] : null;

  // Get books in same classification
  const booksInSameClassification = booksList.filter(b => 
    b.classification_id === selectedBook.classification_id
  );
  const currentClassifIndex = booksInSameClassification.findIndex(b => b.id === selectedBook.id);
  const prevClassifBook = currentClassifIndex > 0 ? booksInSameClassification[currentClassifIndex - 1] : null;
  const nextClassifBook = currentClassifIndex < booksInSameClassification.length - 1 
    ? booksInSameClassification[currentClassifIndex + 1] 
    : null;

  const maxChapters = selectedBook.chapters_count;

  const handlePrevChapter = () => {
    if (selectedChapter > 1) {
      onChapterChange(selectedChapter - 1);
    } else if (prevBook) {
      onBookChange(prevBook);
      onChapterChange(prevBook.chapters_count);
      showSuccess(`→ ${prevBook.name} ${prevBook.chapters_count}`);
    }
  };

  const handleNextChapter = () => {
    if (selectedChapter < maxChapters) {
      onChapterChange(selectedChapter + 1);
    } else if (nextBook) {
      onBookChange(nextBook);
      onChapterChange(1);
      showSuccess(`→ ${nextBook.name} 1`);
    }
  };

  const handleFirstChapter = () => {
    onChapterChange(1);
  };

  const handleLastChapter = () => {
    onChapterChange(maxChapters);
  };

  const handleChapterInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(chapterInput, 10);
    if (!isNaN(num) && num >= 1 && num <= maxChapters) {
      onChapterChange(num);
      setChapterInput('');
      setIsChapterDropdownOpen(false);
    } else {
      showSuccess(`Veuillez entrer un numéro entre 1 et ${maxChapters}`);
    }
  };

  const handleChapterPillClick = (num: number) => {
    onChapterChange(num);
    setIsChapterDropdownOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* PREVIOUS BOOK - Always visible, disabled if no prev book */}
      <Button
        variant="ghost"
        size="sm"
        disabled={!prevBook}
        onClick={() => {
          if (prevBook) {
            onBookChange(prevBook);
            onChapterChange(1);
          }
        }}
        className={`h-9 px-2.5 rounded-full text-xs gap-1 transition-colors ${
          prevBook 
            ? 'text-muted-foreground hover:text-foreground' 
            : 'text-muted-foreground/40 cursor-not-allowed opacity-50'
        }`}
        title={prevBook ? `Livre précédent: ${prevBook.name}` : 'Aucun livre précédent'}
      >
        <ChevronLeft className="w-3 h-3" />
      </Button>

      {/* FIRST CHAPTER (Début) */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleFirstChapter}
        disabled={selectedChapter === 1}
        className="h-9 px-2.5 rounded-full text-xs gap-1"
        title="Premier chapitre"
      >
        <ChevronsLeft className="w-3.5 h-3.5" />
      </Button>

      {/* PREVIOUS CHAPTER (←) */}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrevChapter}
        disabled={selectedChapter === 1 && !prevBook}
        className="h-9 w-9 rounded-full p-0"
        title={selectedChapter > 1 ? "Chapitre précédent" : (prevBook ? `Livre précédent: ${prevBook.name}` : 'Aucun chapitre précédent')}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {/* CHAPTER SELECTOR (DROPDOWN) */}
      <div className="relative">
        <button
          onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
          className="h-9 px-3 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          
          <span>{selectedChapter}</span>
          <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-mono">
            / {maxChapters}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isChapterDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isChapterDropdownOpen && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setIsChapterDropdownOpen(false)}
            />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-40 w-72 bg-card border border-border rounded-2xl shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Aller au chapitre
              </div>
              
              <form onSubmit={handleChapterInputSubmit} className="flex gap-1.5 mb-3">
                <Input
                  type="number"
                  min={1}
                  max={maxChapters}
                  value={chapterInput}
                  onChange={(e) => setChapterInput(e.target.value)}
                  placeholder={`1 - ${maxChapters}`}
                  className="h-9 rounded-xl text-center text-sm font-mono"
                  autoFocus
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="h-9 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                >
                  OK
                </Button>
              </form>

              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Chapitres
              </div>
              <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
                {Array.from({ length: maxChapters }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    onClick={() => handleChapterPillClick(num)}
                    className={`h-8 rounded-lg text-xs font-bold font-mono transition-colors ${
                      num === selectedChapter
                        ? 'bg-amber-600 text-white'
                        : 'hover:bg-amber-500/15 text-foreground'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* NEXT CHAPTER (→) */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleNextChapter}
        disabled={selectedChapter === maxChapters && !nextBook}
        className="h-9 w-9 rounded-full p-0"
        title={selectedChapter < maxChapters ? "Chapitre suivant" : (nextBook ? `Livre suivant: ${nextBook.name}` : 'Aucun chapitre suivant')}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {/* LAST CHAPTER (Fin) */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleLastChapter}
        disabled={selectedChapter === maxChapters}
        className="h-9 px-2.5 rounded-full text-xs gap-1"
        title="Dernier chapitre"
      >
        <ChevronsRight className="w-3.5 h-3.5" />
      </Button>

      {/* NEXT BOOK - Always visible, disabled if no next book */}
      <Button
        variant="ghost"
        size="sm"
        disabled={!nextBook}
        onClick={() => {
          if (nextBook) {
            onBookChange(nextBook);
            onChapterChange(1);
          }
        }}
        className={`h-9 px-2.5 rounded-full text-xs gap-1 transition-colors ${
          nextBook 
            ? 'text-muted-foreground hover:text-foreground' 
            : 'text-muted-foreground/40 cursor-not-allowed opacity-50'
        }`}
        title={nextBook ? `Livre suivant: ${nextBook.name}` : 'Aucun livre suivant'}
      >
        <ChevronRight className="w-3 h-3" />
      </Button>
    </div>
  );
};

export default ChapterNavigator;