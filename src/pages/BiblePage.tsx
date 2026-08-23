import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/bible/Navbar';
import { SearchDialog } from '@/components/bible/SearchDialog';
import { BookmarksDrawer } from '@/components/bible/BookmarksDrawer';
import { DbStatusModal } from '@/components/bible/DbStatusModal';
import { ReaderDialog } from '@/components/bible/ReaderDialog';
import { 
  getDbLanguages, 
  getDbBibleVersions, 
  getDbAllBooks, 
  getDbStats,
  DbLanguage, 
  DbBibleVersion, 
  DbBookItem,
  DbStats
} from '@/services/bibleDb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Globe, 
  BookMarked, 
  Search, 
  ChevronRight, 
  BookOpen, 
  Layers, 
  Check, 
  Loader2,
  Database,
  Scroll
} from 'lucide-react';
import { showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';

export const BiblePage: React.FC = () => {
  // DB states
  const [languages, setLanguages] = useState<DbLanguage[]>([]);
  const [versions, setVersions] = useState<DbBibleVersion[]>([]);
  const [booksList, setBooksList] = useState<DbBookItem[]>([]);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedLanguageId, setSelectedLanguageId] = useState<number | 'ALL'>('ALL');
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('LSG');
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL');
  const [searchBook, setSearchBook] = useState('');

  // Reader state
  const [readerState, setReaderState] = useState<{
    isOpen: boolean;
    bookCode: string;
    bookName: string;
    chapterNumber: number;
    totalChapters: number;
  }>({
    isOpen: false,
    bookCode: 'GEN',
    bookName: 'Genèse',
    chapterNumber: 1,
    totalChapters: 50
  });

  // Modal states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  // 1. Initialisation depuis Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [langs, vers, books, dbStats] = await Promise.all([
          getDbLanguages(),
          getDbBibleVersions(),
          getDbAllBooks(),
          getDbStats()
        ]);

        setLanguages(langs);
        setVersions(vers);
        setBooksList(books);
        setStats(dbStats);

        if (vers && vers.length > 0) {
          const defaultVer = vers.find(v => v.is_default) || vers[0];
          setSelectedVersionCode(defaultVer.code);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des données Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Recharge les traductions des livres si la langue change
  useEffect(() => {
    if (selectedLanguageId !== 'ALL') {
      getDbAllBooks(selectedLanguageId).then(books => {
        if (books.length > 0) setBooksList(books);
      });
    } else {
      getDbAllBooks().then(books => {
        if (books.length > 0) setBooksList(books);
      });
    }
  }, [selectedLanguageId]);

  // Filtrage des versions par langue
  const filteredVersions = versions.filter(v => {
    if (selectedLanguageId === 'ALL') return true;
    return v.language_id === selectedLanguageId;
  });

  // Version active
  const activeVersion = versions.find(v => v.code === selectedVersionCode) || versions[0] || {
    id: 1,
    code: selectedVersionCode || 'LSG',
    name: 'Version de la Bible',
    short_name: selectedVersionCode,
    language_id: 1,
    is_default: true
  };

  // Filtrage des livres
  const filteredBooks = booksList.filter(book => {
    const isOT = book.testament_id === 1 || book.testament_code === 'OT' || book.testament_code === 'AT';
    const isNT = book.testament_id === 2 || book.testament_code === 'NT';

    let matchesTestament = true;
    if (testamentFilter === 'OT') matchesTestament = isOT;
    if (testamentFilter === 'NT') matchesTestament = isNT;

    const matchesSearch = 
      book.name.toLowerCase().includes(searchBook.toLowerCase()) || 
      book.code.toLowerCase().includes(searchBook.toLowerCase());

    return matchesTestament && matchesSearch;
  });

  const handleOpenReader = (book: DbBookItem, chapter: number = 1) => {
    setReaderState({
      isOpen: true,
      bookCode: book.code,
      bookName: book.name,
      chapterNumber: chapter,
      totalChapters: book.chapters_count || 1
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-amber-500/20 selection:text-amber-800">
      {/* Top Navbar */}
      <Navbar
        currentVersion={selectedVersionCode}
        onVersionChange={setSelectedVersionCode}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
      />

      {/* --- HORIZONTAL VERSIONS BAR & LANGUAGE FILTER (Juste après le menu en haut) --- */}
      <section className="border-b border-border/80 bg-card/70 backdrop-blur-md sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Langue Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <div className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 mr-1 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5" />
                <span>Langues ({languages.length}) :</span>
              </div>

              <button
                onClick={() => setSelectedLanguageId('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 ${
                  selectedLanguageId === 'ALL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Toutes les langues
              </button>

              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setSelectedLanguageId(lang.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 ${
                    selectedLanguageId === lang.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {lang.name} ({lang.code})
                </button>
              ))}
            </div>

            {/* Current Active Version Info Badge */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Version active :</span>
              <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 font-bold border border-amber-500/30 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-amber-600" />
                {activeVersion.name} ({activeVersion.code})
              </span>
            </div>
          </div>

          {/* Horizontal List of Version Codes */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-600" /> 
              Versions ({filteredVersions.length}) :
            </span>

            {filteredVersions.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                Aucune version enregistrée pour cette langue.
              </span>
            ) : (
              filteredVersions.map((ver) => {
                const isSelected = ver.code === selectedVersionCode;
                return (
                  <button
                    key={ver.id || ver.code}
                    onClick={() => {
                      setSelectedVersionCode(ver.code);
                      showSuccess(`Version ${ver.code} sélectionnée (${ver.name})`);
                    }}
                    title={`${ver.name} (${ver.code})`}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-600 shadow-sm scale-105'
                        : 'bg-card text-foreground border-border hover:border-amber-500/60 hover:bg-amber-50/60 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{ver.code}</span>
                    {ver.short_name && ver.short_name !== ver.code && (
                      <span className={`text-[10px] font-normal opacity-80`}>
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
        {/* Banner with Supabase Live Data Statistics */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider">
              <Scroll className="w-4 h-4" />
              <span>Base de données biblique active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              Les Saintes Écritures — Version {selectedVersionCode}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {stats ? (
                <>
                  <span className="font-semibold text-foreground">{stats.totalBooks} livres</span>,{' '}
                  <span className="font-semibold text-foreground">{stats.totalChapters.toLocaleString()} chapitres</span> et{' '}
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{stats.totalVerses.toLocaleString()} versets</span> disponibles en base de données.
                </>
              ) : (
                "Accédez à l'intégralité du texte biblique stocké en base de données."
              )}
            </p>
          </div>

          {/* Testament Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-card border border-border shrink-0">
            <button
              onClick={() => setTestamentFilter('ALL')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                testamentFilter === 'ALL'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tous ({booksList.length})
            </button>
            <button
              onClick={() => setTestamentFilter('OT')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                testamentFilter === 'OT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ancien Testament (39)
            </button>
            <button
              onClick={() => setTestamentFilter('NT')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                testamentFilter === 'NT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Nouveau Testament (27)
            </button>
          </div>
        </div>

        {/* Search Bar for Books */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un livre par nom ou code (ex: GEN, Jean, Psaumes...)"
              value={searchBook}
              onChange={(e) => setSearchBook(e.target.value)}
              className="pl-9 h-11 rounded-2xl bg-card border-border text-sm"
            />
          </div>
        </div>

        {/* Loading State or Grid of Books */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <span className="text-sm font-medium">Chargement des 66 livres depuis Supabase...</span>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-3xl bg-card">
            <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold">Aucun livre ne correspond à votre recherche.</p>
            <p className="text-xs text-muted-foreground mt-1">Essayez un autre mot-clé ou changez de filtre.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="rounded-3xl border border-border bg-card p-5 hover:border-amber-500/60 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs font-mono">
                        {book.code}
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">
                          {book.name}
                        </h3>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {book.code} • #{book.order_index}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {book.chapters_count} ch.
                    </span>
                  </div>
                </div>

                {/* Quick Chapter Buttons */}
                <div className="mt-4 pt-3 border-t border-border/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Chapitres ({book.chapters_count}) :
                    </span>
                    <button
                      onClick={() => handleOpenReader(book, 1)}
                      className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Lire dès le ch. 1</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: Math.min(book.chapters_count, 10) }, (_, i) => i + 1).map((ch) => (
                      <button
                        key={ch}
                        onClick={() => handleOpenReader(book, ch)}
                        className="w-7 h-7 rounded-lg bg-muted hover:bg-amber-600 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center"
                      >
                        {ch}
                      </button>
                    ))}
                    {book.chapters_count > 10 && (
                      <button
                        onClick={() => handleOpenReader(book, 1)}
                        className="px-2 h-7 rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground hover:bg-amber-600 hover:text-white transition-colors flex items-center justify-center"
                      >
                        +{book.chapters_count - 10}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Reader Dialog */}
      <ReaderDialog
        isOpen={readerState.isOpen}
        onClose={() => setReaderState(prev => ({ ...prev, isOpen: false }))}
        bookId={readerState.bookCode}
        chapterNumber={readerState.chapterNumber}
        currentVersion={selectedVersionCode}
        onChapterChange={(bookId, chapter) => setReaderState(prev => ({ ...prev, bookCode: bookId, chapterNumber: chapter }))}
        isBookmarked={(id) => bookmarks.some(b => b.id === id)}
        onToggleBookmark={(verse) => {
          if (bookmarks.some(b => b.id === verse.id)) {
            setBookmarks(prev => prev.filter(b => b.id !== verse.id));
            showSuccess("Verset retiré des favoris.");
          } else {
            setBookmarks(prev => [...prev, verse]);
            showSuccess("Verset ajouté aux favoris !");
          }
        }}
      />

      {/* Search Dialog */}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectBookChapter={(bookId, chapter) => {
          const matched = booksList.find(b => b.code.toLowerCase() === bookId.toLowerCase());
          setReaderState({
            isOpen: true,
            bookCode: matched?.code || bookId,
            bookName: matched?.name || bookId,
            chapterNumber: chapter,
            totalChapters: matched?.chapters_count || 1
          });
        }}
      />

      {/* Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        onRemoveBookmark={(id) => setBookmarks(prev => prev.filter(b => b.id !== id))}
        onOpenVerseChapter={(bookId, chapter) => {
          setReaderState({
            isOpen: true,
            bookCode: bookId,
            bookName: bookId,
            chapterNumber: chapter,
            totalChapters: 50
          });
        }}
      />

      {/* Database Diagnostic Modal */}
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