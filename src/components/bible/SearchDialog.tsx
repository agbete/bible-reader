import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Book, Sparkles, ArrowRight, CornerDownLeft } from 'lucide-react';
import { BIBLE_BOOKS, DAILY_VERSES, BookInfo } from '@/data/bibleData';

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

  const trimmed = searchTerm.trim().toLowerCase();

  // Search in books
  const matchingBooks = BIBLE_BOOKS.filter(
    b => b.name.toLowerCase().includes(trimmed) || b.abbr.toLowerCase().includes(trimmed)
  ).slice(0, 6);

  // Search in popular scriptures
  const matchingVerses = DAILY_VERSES.filter(
    v => v.text.toLowerCase().includes(trimmed) || v.reference.toLowerCase().includes(trimmed)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-4 border-b border-border/80">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tapez un nom de livre, une référence (ex: Jean 3, Psaume 23, Paix)..."
              className="pl-9 pr-8 h-11 rounded-2xl border-none shadow-none focus-visible:ring-0 text-sm"
            />
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* Quick Books suggestions */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2 px-2">
              Livres bibliques
            </span>
            <div className="grid grid-cols-2 gap-2">
              {matchingBooks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectBookChapter(b.id, 1);
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-[10px]">
                      {b.abbr}
                    </span>
                    <div>
                      <span className="text-xs font-semibold block group-hover:text-amber-600 transition-colors">
                        {b.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {b.chaptersCount} chapitres
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Verses */}
          {matchingVerses.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2 px-2">
                Versets associés
              </span>
              <div className="space-y-2">
                {matchingVerses.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      onSelectBookChapter('jea', 1);
                      onClose();
                    }}
                    className="p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                      <span>{v.reference}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{v.translation}</span>
                    </div>
                    <p className="text-xs font-serif line-clamp-2 text-foreground">
                      « {v.text} »
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingBooks.length === 0 && matchingVerses.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Aucun résultat pour « {searchTerm} ». Essayez avec le nom d'un livre (ex: Matthieu, Genèse, Romains).
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border/80 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Recherche instantanée dans toute la Bible</span>
          </div>
          <span className="flex items-center gap-1 font-mono">
            <span>ESC pour fermer</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};