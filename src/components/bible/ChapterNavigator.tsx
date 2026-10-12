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
import { TitleNavigator } from './TitleNavigator';

interface ChapterNavigatorProps {
  selectedBook: DbBookItem | null;
  selectedChapter: number;
  booksList: DbBookItem[];
  onChapterChange: (chapter: number) => void;
  onBookChange: (book: DbBookItem) => void;
  titleLanguageId?: number;
  onSelectTitle?: (chapter: number, verseNumber: number, verseId: number) => void;
  compact?: boolean;
}

export const ChapterNavigator: React.FC<ChapterNavigatorProps> = ({
  selectedBook,
  selectedChapter,
  booksList,
  onChapterChange,
  onBookChange,
  titleLanguageId,
  onSelectTitle,
  compact = false
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
    <div className={`flex items-center ${compact ? 'flex-nowrap gap-1' : 'flex-wrap gap-2'}`}>
      {/* CHAPTER SELECTOR (DROPDOWN) with previous / next chapter inside */}
      <div className="relative">
        <div className={`h-9 px-0.5 rounded-full bg-white/10 border border-white/30 text-white text-[18px] leading-none font-bold flex items-center gap-0.5 ${compact ? 'xl:h-6' : ''}`}>
          {/* PREVIOUS CHAPTER (←) */}
          <button
            type="button"
            onClick={handlePrevChapter}
            disabled={selectedChapter === 1 && !prevBook}
            className="h-full px-1 flex items-center rounded-full text-white hover:bg-white/15 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={selectedChapter > 1 ? "Chapitre précédent" : (prevBook ? `Livre précédent: ${prevBook.name}` : 'Aucun chapitre précédent')}
            aria-label="Chapitre précédent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
            className="h-full px-1 rounded-full hover:bg-white/15 flex items-center gap-0.5 transition-colors"
            title="Choisir un chapitre"
          >
            <span>{selectedChapter}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isChapterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* NEXT CHAPTER (→) */}
          <button
            type="button"
            onClick={handleNextChapter}
            disabled={selectedChapter === maxChapters && !nextBook}
            className="h-full px-1 flex items-center rounded-full text-white hover:bg-white/15 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={selectedChapter < maxChapters ? "Chapitre suivant" : (nextBook ? `Livre suivant: ${nextBook.name}` : 'Aucun chapitre suivant')}
            aria-label="Chapitre suivant"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

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

      {/* TITLE NAVIGATION (niveau 4) */}
      <TitleNavigator
        selectedBook={selectedBook}
        selectedChapter={selectedChapter}
        languageId={titleLanguageId}
        onSelectTitle={onSelectTitle ?? ((chapter) => onChapterChange(chapter))}
        compact={compact}
      />
    </div>
  );
};

export default ChapterNavigator;