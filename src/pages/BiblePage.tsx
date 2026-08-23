import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/bible/Navbar';
import { SearchDialog } from '@/components/bible/SearchDialog';
import { BookmarksDrawer } from '@/components/bible/BookmarksDrawer';
import { DbStatusModal } from '@/components/bible/DbStatusModal';
import { ReaderDialog } from '@/components/bible/ReaderDialog';
import { 
  getDbLanguages, 
  getDbBibleVersions, 
  getDbBooks, 
  DbLanguage, 
  DbBibleVersion 
} from '@/services/bibleDb';
import { BIBLE_BOOKS, BookInfo, BibleVerseItem } from '@/data/bibleData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Globe, 
  BookMarked, 
  Search, 
  ChevronRight, 
  BookOpen, 
  Sparkles, 
  Layers, 
  Check, 
  Filter
} from 'lucide-react';
import { showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';

export const BiblePage: React.FC = () => {
  // Languages & Versions from Supabase
  const [languages, setLanguages] = useState<DbLanguage[]>([]);
  const [versions, setVersions] = useState<DbBibleVersion[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<number | 'ALL'>('ALL');
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('LSG');

  // Books & Navigation
  const [booksList, setBooksList] = useState<BookInfo[]>(BIBLE_BOOKS);
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL');
  const [searchBook, setSearchBook] = useState('');

  // Reader state
  const [readerState, setReaderState] = useState<{
    isOpen: boolean;
    bookId: string;
    chapterNumber: number;
  }>({
    isOpen: false,
    bookId: 'gen',
    chapterNumber: 1
  });

  // Modal states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<BibleVerseItem[]>([]);

  // 1. Fetch Languages and Versions from Supabase on mount
  useEffect(() => {
    Promise.all([getDbLanguages(), getDbBibleVersions()]).then(([langs, vers]) => {
      if (langs && langs.length > 0) {
        setLanguages(langs);
      }
      if (vers && vers.length > 0) {
        setVersions(vers);
        const defaultVer = vers.find(v => v.is_default) || vers[0];
        setSelectedVersionCode(defaultVer.code);
      }
    });
  }, []);

  // Filter versions by selected language
  const filteredVersions = versions.filter(v => {
    if (selectedLanguageId === 'ALL') return true;
    return v.language_id === selectedLanguageId;
  });

  // Active version details
  const activeVersion = versions.find(v => v.code === selectedVersionCode) || versions[0] || {
    id: 1,
    code: 'LSG',
    name: 'Louis Segond 1910',
    short_name: 'LSG',
    language_id: 1,
    is_default: true
  };

  // Filter books
  const filteredBooks = booksList.filter(book => {
    const matchesTestament = testamentFilter === 'ALL' || book.testament === testamentFilter;
    const matchesSearch = book.name.toLowerCase().includes(searchBook.toLowerCase()) || 
                          book.abbr.toLowerCase().includes(searchBook.toLowerCase());
    return matchesTestament && matchesSearch;
  });

  const handleOpenReader = (bookId: string, chapter: number = 1) => {
    setReaderState({
      isOpen: true,
      bookId,
      chapterNumber: chapter
    });
  };

  const handleToggleBookmark = (verse: BibleVerseItem) => {
    if (bookmarks.some(b => b.id === verse.id)) {
      setBookmarks(prev => prev.filter(b => b.id !== verse.id));
      showSuccess("Verset retiré des favoris.");
    } else {
      setBookmarks(prev => [...prev, verse]);
      showSuccess("Verset ajouté aux favoris !");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <Navbar
        currentVersion={selectedVersionCode}
        onVersionChange={setSelectedVersionCode}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
      />

      {/* --- HORIZONTAL VERSIONS BAR & LANGUAGE FILTER (Juste après le menu en bas) --- */}
      <section className="border-b border-border/80 bg-card/60 backdrop-blur-md sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-2.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Langue Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1">
                <Globe className="w-3.5 h-3.5 text-amber-600" />
                <span>Langue :</span>
              </div>

              <button
                onClick={() => setSelectedLanguageId('ALL')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all shrink-0 ${
                  selectedLanguageId === 'ALL'
                    ? 'bg-amber-600 text-white font-semibold shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Toutes
              </button>

              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setSelectedLanguageId(lang.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all shrink-0 ${
                    selectedLanguageId === lang.id
                      ? 'bg-amber-600 text-white font-semibold shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>

            {/* Current Active Version Info Badge */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Version active :</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20">
                {activeVersion.name} ({activeVersion.code})
              </span>
            </div>
          </div>

          {/* Horizontal List of Version Codes */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-600" /> Versions :
            </span>

            {filteredVersions.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                Aucune version trouvée pour cette langue.
              </span>
            ) : (
              filteredVersions.map((ver) => {
                const isSelected = ver.code === selectedVersionCode;
                return (
                  <button
                    key={ver.code}
                    onClick={() => {
                      setSelectedVersionCode(ver.code);
                      showSuccess(`Version ${ver.code} sélectionnée (${ver.name})`);
                    }}
                    title={`${ver.name} (${ver.code})`}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-600 shadow-sm scale-105'
                        : 'bg-background text-foreground border-border hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/30'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{ver.code}</span>
                    {ver.short_name && ver.short_name !== ver.code && (
                      <span className={`text-[10px] font-normal ${isSelected ? 'text-amber-100' : 'text-muted-foreground'}`}>
                        • {ver.short_name}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Main Bible Explorer Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider">
              <BookMarked className="w-4 h-4" />
              <span>Texte Biblique Intégral</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-0.5">
              Explorer la Bible en version {selectedVersionCode}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Choisissez un livre et un chapitre pour commencer votre lecture et méditation.
            </p>
          </div>

          {/* Testament Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-card border border-border shrink-0">
            <button
              onClick={() => setTestamentFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                testamentFilter === 'ALL'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tous (66)
            </button>
            <button
              onClick={() => setTestamentFilter('OT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                testamentFilter === 'OT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ancien Testament
            </button>
            <button
              onClick={() => setTestamentFilter('NT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                testamentFilter === 'NT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Nouveau Testament
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrer les livres (ex: Genèse, Psaumes, Jean, Actes...)"
            value={searchBook}
            onChange={(e) => setSearchBook(e.target.value)}
            className="pl-9 h-10 rounded-2xl bg-card border-border text-sm"
          />
        </div>

        {/* Grid of Bible Books with Direct Chapter Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="rounded-3xl border border-border bg-card p-5 hover:border-amber-500/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs font-mono">
                      {book.abbr}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {book.name}
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        {book.category}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {book.chaptersCount} ch.
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                  {book.summary}
                </p>
              </div>

              {/* Quick Chapter Buttons */}
              <div className="mt-4 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Chapitres rapides :
                  </span>
                  <button
                    onClick={() => handleOpenReader(book.id, 1)}
                    className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Tout lire</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(book.chaptersCount, 8) }, (_, i) => i + 1).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => handleOpenReader(book.id, ch)}
                      className="w-7 h-7 rounded-lg bg-muted hover:bg-amber-600 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center"
                    >
                      {ch}
                    </button>
                  ))}
                  {book.chaptersCount > 8 && (
                    <button
                      onClick={() => handleOpenReader(book.id, 1)}
                      className="px-2 h-7 rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground hover:bg-amber-600 hover:text-white transition-colors flex items-center justify-center"
                    >
                      +{book.chaptersCount - 8}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Reader Dialog */}
      <ReaderDialog
        isOpen={readerState.isOpen}
        onClose={() => setReaderState(prev => ({ ...prev, isOpen: false }))}
        bookId={readerState.bookId}
        chapterNumber={readerState.chapterNumber}
        currentVersion={selectedVersionCode}
        onChapterChange={(bookId, chapter) => setReaderState({ isOpen: true, bookId, chapterNumber: chapter })}
        isBookmarked={(id) => bookmarks.some(b => b.id === id)}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* Search & Bookmarks & Db status dialogs */}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectBookChapter={(bookId, chapter) => handleOpenReader(bookId, chapter)}
      />

      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        onRemoveBookmark={(id) => setBookmarks(prev => prev.filter(b => b.id !== id))}
        onOpenVerseChapter={(bookId, chapter) => handleOpenReader(bookId, chapter)}
      />

      <DbStatusModal
        isOpen={isDbStatusOpen}
        onClose={() => setIsDbStatusOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/20 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-foreground">Parole Vivante — Page Bible</span>
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

export default BiblePage;