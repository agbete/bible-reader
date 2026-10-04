import React, { useState } from 'react';
import { 
  HeartHandshake, 
  Sparkles, 
  ChevronRight, 
  BookOpen, 
  Copy, 
  Check 
} from 'lucide-react';
import { THEMES_DATA, MoodTheme, BibleVerseItem } from '@/data/bibleData';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { showSuccess } from '@/utils/toast';

interface TopicExplorerProps {
  onReadVerseChapter: (bookId: string, chapter: number) => void;
}

export const TopicExplorer: React.FC<TopicExplorerProps> = ({ onReadVerseChapter }) => {
  const [activeTheme, setActiveTheme] = useState<MoodTheme | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (verse: BibleVerseItem) => {
    navigator.clipboard.writeText(`"${verse.text}" — ${verse.reference}`);
    setCopiedId(verse.id);
    showSuccess("Verset copié !");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getBookId = (bookName: string) => {
    const map: Record<string, string> = {
      'Psaumes': 'psa',
      'Jean': 'jea',
      'Josué': 'jos',
      'Philippiens': 'phi',
      '1 Pierre': '1pi',
      'Matthieu': 'mat',
      '1 Jean': '1je',
      'Romains': 'rom',
      'Jacques': 'jac',
      'Proverbes': 'pro',
      'Jérémie': 'jer'
    };
    return map[bookName] || 'psa';
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider">
            <HeartHandshake className="w-4 h-4" />
            <span>Paroles de Vie selon vos besoins</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            Thèmes & Méditations du Cœur
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Que traversez-vous aujourd'hui ? Laissez la Parole de Dieu vous renouveler et vous consoler.
          </p>
        </div>
      </div>

      {/* Topic Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {THEMES_DATA.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setActiveTheme(theme)}
            className="group text-left p-3.5 sm:p-4 rounded-2xl border border-border bg-card hover:bg-muted/40 transition-all hover:scale-[1.02] hover:shadow-sm flex flex-col justify-between"
          >
            <div>
              <span className="text-2xl mb-2 block">{theme.emoji}</span>
              <h3 className="font-semibold text-xs sm:text-sm text-foreground group-hover:text-amber-600 transition-colors">
                {theme.title}
              </h3>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                {theme.description}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <span>{theme.verses.length} versets</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>

      {/* Theme Verses Modal */}
      {activeTheme && (
        <Dialog open={!!activeTheme} onOpenChange={(open) => !open && setActiveTheme(null)}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeTheme.emoji}</span>
                <DialogTitle className="text-xl font-bold">
                  {activeTheme.title}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                {activeTheme.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-3">
              {activeTheme.verses.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-2xl border border-border bg-muted/30 relative group flex flex-col justify-between gap-3"
                >
                  <blockquote className="text-sm sm:text-base font-serif italic text-foreground leading-relaxed">
                    « {v.text} »
                  </blockquote>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="font-semibold text-xs text-amber-600 dark:text-amber-400">
                      {v.reference}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(v)}
                        className="h-7 px-2 text-xs rounded-full"
                      >
                        {copiedId === v.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 mr-1" />
                        )}
                        <span>{copiedId === v.id ? 'Copié' : 'Copier'}</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          onReadVerseChapter(getBookId(v.book), v.chapter);
                          setActiveTheme(null);
                        }}
                        className="h-7 px-2.5 text-xs rounded-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                      >
                        <BookOpen className="w-3 h-3 mr-1" />
                        <span>Lire le chapitre</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
};