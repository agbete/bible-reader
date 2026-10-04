import React from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bookmark, Trash2, BookOpen, Copy, Check } from 'lucide-react';
import { BibleVerseItem } from '@/data/bibleData';
import { showSuccess } from '@/utils/toast';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BibleVerseItem[];
  onRemoveBookmark: (id: string) => void;
  onOpenVerseChapter: (bookId: string, chapter: number) => void;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onRemoveBookmark,
  onOpenVerseChapter
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (verse: BibleVerseItem) => {
    navigator.clipboard.writeText(`"${verse.text}" — ${verse.reference}`);
    setCopiedId(verse.id);
    showSuccess("Verset copié !");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-6">
        <SheetHeader className="text-left pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Bookmark className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold">Mes Versets Favoris</SheetTitle>
              <SheetDescription className="text-xs">
                {bookmarks.length} verset{bookmarks.length > 1 ? 's' : ''} enregistré{bookmarks.length > 1 ? 's' : ''}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {bookmarks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Bookmark className="w-10 h-10 mx-auto stroke-1 text-muted-foreground/40" />
              <p className="text-sm font-medium">Aucun verset favori</p>
              <p className="text-xs">
                Cliquez sur l’icône de signet près d’un verset pour le retrouver facilement ici.
              </p>
            </div>
          ) : (
            bookmarks.map((verse) => (
              <div
                key={verse.id}
                className="p-4 rounded-2xl border border-border bg-card relative group flex flex-col justify-between gap-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-amber-600 dark:text-amber-400">
                    {verse.reference}
                  </span>
                  <button
                    onClick={() => onRemoveBookmark(verse.id)}
                    className="text-muted-foreground hover:text-rose-500 p-1 transition-colors"
                    title="Supprimer du signet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <blockquote className="text-xs sm:text-sm font-serif italic text-foreground leading-relaxed">
                  « {verse.text} »
                </blockquote>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(verse)}
                    className="h-7 px-2 text-xs rounded-full"
                  >
                    {copiedId === verse.id ? <Check className="w-3 h-3 text-emerald-500 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    <span>Copier</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenVerseChapter('psa', verse.chapter || 1);
                      onClose();
                    }}
                    className="h-7 px-3 text-xs rounded-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    <BookOpen className="w-3 h-3 mr-1" />
                    <span>Lire</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};