import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDbChapterVerses, DbBookItem, DbVerseItem } from '@/services/bibleDb';

/** Un passage : du verset de début au verset de fin (null = fin du chapitre ; -1 = dernier verset, à résoudre) */
interface Range {
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number | null;
}

/** Passage d'un lien de titre de niveau 5 */
export interface PassageProps {
  book: DbBookItem;
  /** Nom du livre dans la langue de la version */
  bookName: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  /** null = jusqu'à la fin du chapitre */
  endVerse: number | null;
  versionCode: string;
  /** Code affiché de la version (code_display) */
  versionLabel: string;
  /** Ouvre le verset sur la page de lecture */
  onGoToVerse: (book: DbBookItem, chapter: number, verse: number) => void;
}

/** Au-delà, on ne charge pas les chapitres suivants d'un passage (sécurité) */
const MAX_CHAPTERS = 6;

/**
 * Contenu d'un passage : tous ses versets, un lien vers le passage et des boutons
 * pour ajouter le verset précédent / suivant. Affiché dans une bulle ou dans le panneau latéral.
 */
export const PassagePreview: React.FC<PassageProps & {
  /** Panneau latéral : bouton de fermeture et hauteur pleine */
  docked?: boolean;
  onClose: () => void;
}> = ({
  book, bookName, startChapter, startVerse, endChapter, endVerse,
  versionCode, versionLabel, onGoToVerse, docked = false, onClose,
}) => {
  const [range, setRange] = useState<Range>(() => ({
    startChapter,
    startVerse,
    endChapter: Math.min(endChapter, startChapter + MAX_CHAPTERS - 1, book.chapters_count),
    endVerse,
  }));
  const [chapters, setChapters] = useState<Map<number, DbVerseItem[]>>(new Map());

  // Chapitres nécessaires au passage (dans la version du titre)
  const missing = useMemo(() => {
    const list: number[] = [];
    for (let ch = range.startChapter; ch <= range.endChapter; ch++) if (!chapters.has(ch)) list.push(ch);
    return list;
  }, [range, chapters]);
  useEffect(() => {
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(ch => getDbChapterVerses(book.id, ch, versionCode).then(list => [ch, list] as const)))
      .then(loaded => {
        if (cancelled) return;
        setChapters(prev => {
          const next = new Map(prev);
          loaded.forEach(([ch, list]) => next.set(ch, list));
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [missing, book.id, versionCode]);

  const ready = missing.length === 0;
  const lastVerseOf = (ch: number) => chapters.get(ch)?.[chapters.get(ch)!.length - 1]?.verse_number ?? 1;
  const resolvedStart = ready && range.startVerse === -1 ? lastVerseOf(range.startChapter) : range.startVerse;
  const resolvedEnd = ready ? (range.endVerse === null || range.endVerse === -1 ? lastVerseOf(range.endChapter) : range.endVerse) : null;

  // Versets du passage, dans l'ordre
  const shown = useMemo(() => {
    if (!ready || resolvedEnd === null) return [];
    const list: { chapter: number; verse: DbVerseItem }[] = [];
    for (let ch = range.startChapter; ch <= range.endChapter; ch++) {
      (chapters.get(ch) ?? []).forEach(v => {
        if (ch === range.startChapter && v.verse_number < resolvedStart) return;
        if (ch === range.endChapter && v.verse_number > resolvedEnd) return;
        list.push({ chapter: ch, verse: v });
      });
    }
    return list;
  }, [ready, range, chapters, resolvedStart, resolvedEnd]);

  const firstOfChapter = (ch: number) => chapters.get(ch)?.[0]?.verse_number ?? 1;
  const canPrevious = ready && (range.startChapter > 1 || resolvedStart > firstOfChapter(range.startChapter));
  const canNext = ready && resolvedEnd !== null && (range.endChapter < book.chapters_count || resolvedEnd < lastVerseOf(range.endChapter));

  // Précédent : ajoute le verset avant le passage ; Suivant : ajoute le verset après
  const addPrevious = () => {
    if (!canPrevious) return;
    if (resolvedStart > firstOfChapter(range.startChapter)) setRange(r => ({ ...r, startVerse: resolvedStart - 1 }));
    else setRange(r => ({ ...r, startChapter: r.startChapter - 1, startVerse: -1 }));
  };
  const addNext = () => {
    if (!canNext || resolvedEnd === null) return;
    if (resolvedEnd < lastVerseOf(range.endChapter)) setRange(r => ({ ...r, endVerse: resolvedEnd + 1 }));
    else setRange(r => ({ ...r, endChapter: r.endChapter + 1, endVerse: firstOfChapter(r.endChapter + 1) || 1 }));
  };

  const reference = (() => {
    if (!ready || resolvedEnd === null) return `${bookName} ${range.startChapter}`;
    const start = `${range.startChapter}:${resolvedStart}`;
    if (range.startChapter === range.endChapter) {
      return resolvedStart === resolvedEnd ? `${bookName} ${start}` : `${bookName} ${start}-${resolvedEnd}`;
    }
    return `${bookName} ${start}–${range.endChapter}:${resolvedEnd}`;
  })();
  const multiChapter = range.startChapter !== range.endChapter;

  return (
    <div className={`font-cambria not-italic font-normal text-left flex flex-col ${docked ? 'h-full' : ''}`}>
      {/* Référence et version */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-500/30 shrink-0">
        <span className="font-bold text-[14px] text-amber-800 dark:text-amber-300">{reference}</span>
        {ready && shown.length > 1 && (
          <span className="text-[11px] text-muted-foreground">{shown.length} versets</span>
        )}
        <span className="ml-auto px-1.5 py-px rounded-full bg-amber-600 text-white text-[11px] font-bold">{versionLabel}</span>
        {docked && (
          <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-amber-200/70 dark:hover:bg-amber-800/60" title="Fermer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Versets du passage */}
      <div className={`px-3 py-2 overflow-y-auto overscroll-contain thin-scrollbar text-[15px] leading-snug text-foreground ${docked ? 'flex-1 min-h-0' : 'max-h-[45vh]'}`}>
        {!ready ? (
          <span className="flex items-center gap-2 text-muted-foreground text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </span>
        ) : shown.length === 0 ? (
          <span className="italic text-muted-foreground">Passage non disponible dans cette version.</span>
        ) : (
          <div className="space-y-1">
            {shown.map(({ chapter, verse }) => (
              <p key={`${chapter}:${verse.verse_number}`}>
                <sup className="mr-1 font-sans text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {multiChapter ? `${chapter}:${verse.verse_number}` : verse.verse_number}
                </sup>
                {verse.is_missing
                  ? <span className="italic text-muted-foreground">—</span>
                  : verse.text}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Verset précédent, lien vers le passage, verset suivant */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border bg-muted/30 shrink-0">
        <button
          type="button"
          onClick={addPrevious}
          disabled={!canPrevious}
          className="h-7 px-2 rounded-md flex items-center gap-1 text-[12px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 disabled:hover:bg-transparent"
          title="Ajouter le verset précédent"
        >
          <ChevronLeft className="w-4 h-4" /> Précédent
        </button>
        <button
          type="button"
          onClick={() => { onClose(); onGoToVerse(book, range.startChapter, resolvedStart); }}
          disabled={!ready}
          className="mx-auto h-7 px-3 rounded-md flex items-center gap-1.5 text-[12px] font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Aller au passage <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={addNext}
          disabled={!canNext}
          className="h-7 px-2 rounded-md flex items-center gap-1 text-[12px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 disabled:hover:bg-transparent"
          title="Ajouter le verset suivant"
        >
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * Lien d'un titre de niveau 5.
 * - onOpenDocked (une seule version) : le passage s'affiche dans le panneau latéral de la page (30 %).
 * - Sinon, bulle ; avec getAnchorRect elle se place sur une autre colonne que celle du lien cliqué.
 */
export const ReferencePreview: React.FC<PassageProps & {
  /** Texte du lien dans le titre, ex. « Matthieu 5:15-22 » */
  label: string;
  className?: string;
  title?: string;
  /** Zone où placer la bulle (colonne voisine, à la hauteur du lien) */
  getAnchorRect?: (link: HTMLElement) => DOMRect | null;
  onOpenDocked?: () => void;
}> = ({ label, className, title, getAnchorRect, onOpenDocked, ...passage }) => {
  const [open, setOpen] = useState(false);
  const linkRef = useRef<HTMLButtonElement>(null);
  // Ancre virtuelle recalculée à chaque repositionnement (défilement compris)
  const virtualAnchor = useMemo(() => ({
    current: {
      getBoundingClientRect: () =>
        (linkRef.current && getAnchorRect?.(linkRef.current)) || linkRef.current?.getBoundingClientRect() || new DOMRect(),
    },
  }), [getAnchorRect]);

  if (onOpenDocked) {
    return (
      <button
        ref={linkRef}
        type="button"
        onClick={e => { e.stopPropagation(); onOpenDocked(); }}
        className={className}
        title={title}
      >
        {label}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button ref={linkRef} type="button" onClick={e => e.stopPropagation()} className={className} title={title}>
          {label}
        </button>
      </PopoverTrigger>
      {getAnchorRect && (
        <PopoverPrimitive.Anchor virtualRef={virtualAnchor as React.RefObject<{ getBoundingClientRect: () => DOMRect }>} />
      )}
      <PopoverContent
        side="bottom"
        align="start"
        onClick={e => e.stopPropagation()}
        className={`p-0 rounded-xl shadow-xl overflow-hidden ${
          getAnchorRect ? 'w-[var(--radix-popper-anchor-width)] min-w-[16rem] max-w-[92vw]' : 'w-[min(28rem,92vw)]'
        }`}
      >
        <PassagePreview {...passage} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
