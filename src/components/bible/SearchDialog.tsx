import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Book, Sparkles, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { BIBLE_BOOKS } from '@/data/bibleData';
import { searchDbVerses } from '@/services/bibleDb';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBookChapter: (bookId: string, chapter: number) => void;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({
  isOpen,
  onClose,
  onSelectBookChapter
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  const trimmed = searchTerm.trim().toLowerCase();

  // Search in books
  const matchingBooks = BIBLE_BOOKS.filter(
    b => b.name.toLowerCase().includes(trimmed) || b.abbr.toLowerCase().includes(trimmed) || b.id.toLowerCase().includes(trimmed)
  ).slice(0, 6);

  // Debounced search on Supabase verse_texts
  useEffect(() => {
    if (!trimmed || trimmed.length < 3) {
      setDbResults([]);
      setIsSearchingDb(false);
      return;
    }

    setIsSearchingDb(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchDbVerses(trimmed, 'LSG', 12);
        setDbResults(results || []);
      } catch (err) {
        console.error('Erreur recherche versets:', err);
        setDbResults([]);
      } finally {
        setIsSearchingDb(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [trimmed]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-4 border-b border-border/80">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par mot (ex: paix, amour, lumière), livre (ex: Romains, Psaumes)..."
              className="pl-10 pr-9 h-11 rounded-2xl border-none shadow-none focus-visible:ring-0 text-sm"
            />
            {isSearchingDb && (
              <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-amber-600" />
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto p-4 space-y-4">
          {/* Suggestions de livres bibliques */}
          {matchingBooks.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2 px-1">
                Livres bibliques
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchingBooks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onSelectBookChapter(b.id, 1);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-2xl border border-border bg-card hover:bg-amber-500/10 hover:border-amber-500/30 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs font-mono">
                        {b.abbr}
                      </span>
                      <div>
                        <span className="text-xs font-bold block group-hover:text-amber-600 transition-colors">
                          {b.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {b.chaptersCount} chapitres • {b.category}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Versets trouvés dans Supabase */}
          {dbResults.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2 px-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Versets correspondants ({dbResults.length})</span>
              </span>
              <div className="space-y-2">
                {dbResults.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      onSelectBookChapter(v.bookCode || 'GEN', v.chapterNumber || 1);
                      onClose();
                    }}
                    className="p-3.5 rounded-2xl border border-border bg-muted/20 hover:bg-amber-500/10 hover:border-amber-500/30 cursor-pointer transition-all space-y-1 group"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                      <span className="flex items-center gap-1.5 font-mono">
                        <BookOpen className="w-3.5 h-3.5" />
                        {v.reference_code || `${v.bookCode} ${v.chapterNumber}:${v.verseNumber}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-amber-600 transition-colors font-sans">
                        Lire le chapitre →
                      </span>
                    </div>
                    <p className="text-xs font-serif leading-relaxed text-foreground line-clamp-2">
                      « {v.text} »
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aucun résultat */}
          {trimmed.length >= 2 && matchingBooks.length === 0 && dbResults.length === 0 && !isSearchingDb && (
            <div className="text-center py-10 text-muted-foreground text-xs space-y-1">
              <Book className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-foreground">Aucun résultat trouvé pour « {searchTerm} »</p>
              <p className="text-muted-foreground">Essayez avec un nom de livre ou un mot-clé spirituel.</p>
            </div>
          )}

          {/* État vide initial */}
          {trimmed.length === 0 && (
            <div className="py-6 text-center space-y-3">
              <span className="text-xs text-muted-foreground">Recherches populaires :</span>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-sm mx-auto">
                {['Jean', 'Psaumes 23', 'Paix', 'Amour', 'Foi', 'Genèse', 'Espérance', 'Lumière'].map((kw) => (
                  <button
                    key={kw}
                    onClick={() => setSearchTerm(kw)}
                    className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium hover:bg-amber-500/20 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border/80 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Recherche instantanée dans toute la Bible</span>
          </div>
          <span className="font-mono text-[10px]">
            ESC pour fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};