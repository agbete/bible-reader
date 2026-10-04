import React, { useState } from 'react';
import { 
  BookMarked, 
  Search, 
  Layers, 
  ChevronRight, 
  Sparkles,
  Book,
  Scroll
} from 'lucide-react';
import { BIBLE_BOOKS, BookInfo } from '@/data/bibleData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface BookExplorerProps {
  onSelectChapter: (bookId: string, chapterNumber: number) => void;
}

export const BookExplorer: React.FC<BookExplorerProps> = ({ onSelectChapter }) => {
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedBookForChapters, setSelectedBookForChapters] = useState<BookInfo | null>(null);

  // Extract unique categories based on current testament
  const currentBooks = BIBLE_BOOKS.filter(book => {
    if (testamentFilter === 'ALL') return true;
    return book.testament === testamentFilter;
  });

  const categories = Array.from(new Set(currentBooks.map(b => b.category)));

  const filteredBooks = currentBooks.filter(book => {
    const matchesSearch = book.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          book.abbr.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          book.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || book.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <section className="space-y-6">
      {/* Section Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider">
            <Scroll className="w-4 h-4" />
            <span>Bibliothèque Sacrée</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Explorer les Livres de la Bible
          </h2>
          <p className="text-sm text-muted-foreground">
            66 livres divinement inspirés répartis en l'Ancien et le Nouveau Testament.
          </p>
        </div>

        {/* Testament Switch Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-muted/80 border border-border w-fit">
          <button
            onClick={() => { setTestamentFilter('ALL'); setCategoryFilter('ALL'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              testamentFilter === 'ALL'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tous (66)
          </button>
          <button
            onClick={() => { setTestamentFilter('OT'); setCategoryFilter('ALL'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              testamentFilter === 'OT'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Ancien Testament (39)
          </button>
          <button
            onClick={() => { setTestamentFilter('NT'); setCategoryFilter('ALL'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              testamentFilter === 'NT'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Nouveau Testament (27)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrer par nom (ex: Genèse, Psaumes, Jean, Romains...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-card border-border/80 text-xs sm:text-sm"
          />
        </div>

        {/* Categories scrollable pill list */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full sm:max-w-md no-scrollbar">
          <Button
            variant={categoryFilter === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter('ALL')}
            className={`h-9 px-3 rounded-full text-xs shrink-0 ${
              categoryFilter === 'ALL' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
            }`}
          >
            Toutes catégories
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className={`h-9 px-3 rounded-full text-xs shrink-0 ${
                categoryFilter === cat ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid of Books */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-2xl bg-card">
          <Book className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">Aucun livre ne correspond à votre recherche</p>
          <p className="text-xs text-muted-foreground mt-1">Essayez un autre mot-clé ou réinitialisez les filtres.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              onClick={() => setSelectedBookForChapters(book)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-amber-500/40 hover:-translate-y-0.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold font-mono">
                      {book.abbr}
                    </span>
                    <div>
                      <h3 className="font-semibold text-sm group-hover:text-amber-600 transition-colors">
                        {book.name}
                      </h3>
                      <span className="text-[10px] text-muted-foreground">
                        {book.category}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                    {book.chaptersCount} ch.
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                  {book.summary}
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span>Choisir un chapitre</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chapter Selection Modal */}
      {selectedBookForChapters && (
        <Dialog open={!!selectedBookForChapters} onOpenChange={(open) => !open && setSelectedBookForChapters(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono text-xs font-bold">
                  {selectedBookForChapters.abbr}
                </span>
                <DialogTitle className="text-xl font-bold">
                  {selectedBookForChapters.name}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                {selectedBookForChapters.summary} ({selectedBookForChapters.chaptersCount} chapitres)
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Sélectionnez un chapitre à lire :
              </h4>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                {Array.from({ length: selectedBookForChapters.chaptersCount }, (_, i) => i + 1).map((ch) => (
                  <Button
                    key={ch}
                    variant="outline"
                    onClick={() => {
                      onSelectChapter(selectedBookForChapters.id, ch);
                      setSelectedBookForChapters(null);
                    }}
                    className="h-10 rounded-xl font-semibold text-xs hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-colors"
                  >
                    {ch}
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
};