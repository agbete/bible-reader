import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenText, ChevronDown, Loader2 } from 'lucide-react';
import { getLsgVerseTexts, getStrongOccurrences, StrongBookOccurrences } from '@/services/strongDb';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Met en exergue, dans le texte du verset, les mots qui traduisent le code */
const highlightWords = (text: string, words: string[]): React.ReactNode => {
  const terms = words.filter(Boolean).map(w => escapeRegExp(w.replace(/[’‘]/g, "'")).replace(/'/g, "['’]").replace(/\s+/g, '\\s+'));
  if (terms.length === 0) return text;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    nodes.push(text.slice(last, match.index));
    nodes.push(
      <mark key={match.index} className="bg-amber-200/80 dark:bg-amber-700/60 text-inherit rounded px-0.5">
        {match[0]}
      </mark>
    );
    last = match.index! + match[0].length;
  }
  nodes.push(text.slice(last));
  return nodes;
};

const formatCount = (n: number) => n.toLocaleString('fr-FR');

interface Props {
  code: number;
  /** Titre de section, fourni par la page pour garder le même style */
  renderTitle: (aside: React.ReactNode) => React.ReactNode;
}

/** Occurrences du code dans la Segond 1910, par livre ; un clic sur un livre affiche les versets */
export const StrongOccurrences: React.FC<Props> = ({ code, renderTitle }) => {
  const [books, setBooks] = useState<StrongBookOccurrences[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [texts, setTexts] = useState<Map<string, string>>(new Map());
  const [loadingTexts, setLoadingTexts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBooks(null);
    setError(false);
    setSelectedBook(null);
    getStrongOccurrences(code)
      .then(result => { if (!cancelled) setBooks(result); })
      .catch(err => { console.error('Error loading Strong occurrences:', err); if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [code]);

  const book = books?.find(b => b.dbCode === selectedBook) ?? null;

  // Textes des versets du livre ouvert
  useEffect(() => {
    if (!book) return;
    const missing = book.verses.map(v => v.referenceCode).filter(ref => !texts.has(ref));
    if (missing.length === 0) return;
    let cancelled = false;
    setLoadingTexts(true);
    getLsgVerseTexts(missing)
      .then(found => { if (!cancelled) setTexts(prev => new Map([...prev, ...found])); })
      .finally(() => { if (!cancelled) setLoadingTexts(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  const total = useMemo(() => books?.reduce((sum, b) => sum + b.count, 0) ?? 0, [books]);
  const maxCount = useMemo(() => Math.max(1, ...(books ?? []).map(b => b.count)), [books]);

  const aside = books && books.length > 0 && (
    <span className="text-[12px] text-muted-foreground whitespace-nowrap">
      <strong className="font-cambria text-[15px] text-foreground">{formatCount(total)}</strong> occurrence{total > 1 ? 's' : ''} · {books.length} livre{books.length > 1 ? 's' : ''}
    </span>
  );

  return (
    <section className="rounded-xl border border-border bg-card px-5 sm:px-8 py-5">
      {renderTitle(aside)}

      {!books && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Recherche des occurrences…
        </div>
      )}
      {error && <p className="text-sm text-destructive">Impossible de charger les occurrences.</p>}
      {books && books.length === 0 && (
        <p className="font-cambria italic text-[15px] text-muted-foreground">
          Aucune occurrence dans les livres déjà reliés aux codes Strong.
        </p>
      )}

      {books && books.length > 0 && (
        <>
          {/* Livres */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {books.map(b => {
              const active = b.dbCode === selectedBook;
              return (
                <button
                  key={b.dbCode}
                  onClick={() => setSelectedBook(active ? null : b.dbCode)}
                  aria-expanded={active}
                  className={`group text-left rounded-lg border px-3 py-2 transition-all ${
                    active
                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-900/30 shadow-md'
                      : 'border-border hover:border-amber-400 hover:shadow-sm'
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-cambria text-[15px] font-bold truncate">{b.name}</span>
                    <span className="font-cambria text-[17px] font-bold tabular-nums text-amber-700 dark:text-amber-400">{formatCount(b.count)}</span>
                  </span>
                  <span className="mt-1.5 block h-1 rounded-full bg-amber-100 dark:bg-amber-950 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-700"
                      style={{ width: `${Math.max(4, (b.count / maxCount) * 100)}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Détail du livre choisi */}
          {book && (
            <div className="mt-4 rounded-xl border border-amber-300/60 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-300/50 dark:border-amber-800">
                <BookOpenText className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <h4 className="font-cambria text-[17px] font-bold">{book.name}</h4>
                <span className="text-[12px] text-muted-foreground">
                  {formatCount(book.count)} occurrence{book.count > 1 ? 's' : ''} dans {book.verses.length} verset{book.verses.length > 1 ? 's' : ''}
                </span>
                {loadingTexts && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                <button
                  onClick={() => setSelectedBook(null)}
                  className="ml-auto p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  title="Fermer"
                >
                  <ChevronDown className="w-4 h-4 rotate-180" />
                </button>
              </div>
              <ol className="max-h-[28rem] overflow-y-auto thin-scrollbar divide-y divide-amber-200/50 dark:divide-amber-900/50">
                {book.verses.map(v => {
                  const text = texts.get(v.referenceCode);
                  return (
                    <li key={v.referenceCode} className="grid grid-cols-[4.5rem_1fr] gap-3 px-4 py-2">
                      <span className="font-cambria text-[14px] font-bold text-amber-800 dark:text-amber-300 tabular-nums pt-px">
                        {v.chapter}:{v.verse}
                      </span>
                      <span className="font-cambria text-[15px] leading-relaxed">
                        {text ? highlightWords(text, v.words) : (
                          <span className="italic text-muted-foreground">{loadingTexts ? '…' : v.words.join(', ')}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
};
