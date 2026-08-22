import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/bible/Navbar';
import { DailyVerseCard } from '@/components/bible/DailyVerseCard';
import { BookExplorer } from '@/components/bible/BookExplorer';
import { TopicExplorer } from '@/components/bible/TopicExplorer';
import { ReadingPlans } from '@/components/bible/ReadingPlans';
import { ReaderDialog } from '@/components/bible/ReaderDialog';
import { SearchDialog } from '@/components/bible/SearchDialog';
import { BookmarksDrawer } from '@/components/bible/BookmarksDrawer';
import { BibleVerseItem, DAILY_VERSES } from '@/data/bibleData';
import { showSuccess } from '@/utils/toast';
import { BookOpen, Heart, Sparkles, Compass, Shield, Flame, BookCheck, Share2 } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Index = () => {
  const [currentVersion, setCurrentVersion] = useState('LSG');
  const [streakCount, setStreakCount] = useState(7);
  
  // Bookmarks
  const [bookmarks, setBookmarks] = useState<BibleVerseItem[]>([
    DAILY_VERSES[0],
    DAILY_VERSES[3]
  ]);

  // Reader state
  const [readerState, setReaderState] = useState<{
    isOpen: boolean;
    bookId: string;
    chapterNumber: number;
  }>({
    isOpen: false,
    bookId: 'psa',
    chapterNumber: 23
  });

  // Dialogs
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenReader = (bookId: string, chapterNumber: number) => {
    setReaderState({
      isOpen: true,
      bookId,
      chapterNumber
    });
  };

  const handleCloseReader = () => {
    setReaderState(prev => ({ ...prev, isOpen: false }));
  };

  const handleChapterChange = (bookId: string, chapter: number) => {
    setReaderState({
      isOpen: true,
      bookId,
      chapterNumber: chapter
    });
  };

  const isBookmarked = (id: string) => {
    return bookmarks.some(b => b.id === id);
  };

  const handleToggleBookmark = (verse: BibleVerseItem) => {
    if (isBookmarked(verse.id)) {
      setBookmarks(prev => prev.filter(b => b.id !== verse.id));
      showSuccess("Verset retiré de vos favoris.");
    } else {
      setBookmarks(prev => [...prev, verse]);
      showSuccess("Verset ajouté à vos favoris !");
    }
  };

  const handleRemoveBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    showSuccess("Verset supprimé de vos favoris.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-amber-500/20 selection:text-amber-800">
      {/* Top Navigation */}
      <Navbar
        currentVersion={currentVersion}
        onVersionChange={setCurrentVersion}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        streakCount={streakCount}
        onQuickExplore={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-12">
        {/* Hero Section with Daily Verse Card */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Bonjour & Paix à vous 👋
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Que la Parole de Dieu soit une lampe à vos pieds et une lumière sur votre sentier.
              </p>
            </div>
          </div>

          <DailyVerseCard
            currentVersion={currentVersion}
            isBookmarked={isBookmarked}
            onToggleBookmark={handleToggleBookmark}
            onReadChapter={handleOpenReader}
          />
        </section>

        {/* Daily Reading Plan Section */}
        <ReadingPlans
          onSelectPassage={(bookId, chapter) => handleOpenReader(bookId, chapter)}
        />

        {/* Topics and Emotions Explorer */}
        <TopicExplorer
          onReadVerseChapter={(bookId, chapter) => handleOpenReader(bookId, chapter)}
        />

        {/* Comprehensive Book Explorer */}
        <BookExplorer
          onSelectChapter={(bookId, chapter) => handleOpenReader(bookId, chapter)}
        />
      </main>

      {/* Reading Chapter Modal View */}
      <ReaderDialog
        isOpen={readerState.isOpen}
        onClose={handleCloseReader}
        bookId={readerState.bookId}
        chapterNumber={readerState.chapterNumber}
        currentVersion={currentVersion}
        onChapterChange={handleChapterChange}
        isBookmarked={isBookmarked}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* Global Search Dialog */}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectBookChapter={(bookId, chapter) => handleOpenReader(bookId, chapter)}
      />

      {/* Bookmarks Saved Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        onRemoveBookmark={handleRemoveBookmark}
        onOpenVerseChapter={(bookId, chapter) => handleOpenReader(bookId, chapter)}
      />

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/20 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-foreground">Parole Vivante — Application Sainte Bible</span>
          </div>
          <p className="text-center sm:text-right">
            « Toute Écriture est inspirée de Dieu, et utile pour enseigner... » — 2 Timothée 3:16
          </p>
        </div>
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Index;