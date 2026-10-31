import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, Languages, Loader2, X } from 'lucide-react';
import { getLsgVerseTexts, StrongWordOccurrence } from '@/services/strongDb';

interface Props {
  /** Titre de la liste : un mot (« pères ») ou le code (H1) */
  title: string;
  /** Mots à surligner dans les versets */
  words: string[];
  /** Occurrences du mot (ou de tous les mots) portant le code */
  occurrences: StrongWordOccurrence[];
  /** Code affiché de la version (ex. LSG) */
  versionLabel: string;
  /** Mot translittéré, affiché entre parenthèses après chaque mot trouvé (ex. ’ab) */
  transliteration?: string;
  onClose: () => void;
}

const SHOW_TRANSLIT_KEY = 'strong-show-translit';

const formatCount = (n: number) => n.toLocaleString('fr-FR');
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Versets où le mot porte le code (80 %) et livres avec leur nombre d'occurrences (20 %) */
export const StrongTermVerses: React.FC<Props> = ({ title, words, occurrences, versionLabel, transliteration, onClose }) => {
  const [texts, setTexts] = useState<Map<string, string> | null>(null);
  // Afficher le mot translittéré après chaque mot trouvé (mémorisé dans le navigateur)
  const [showTranslit, setShowTranslit] = useState(() => {
    try { return localStorage.getItem(SHOW_TRANSLIT_KEY) !== '0'; } catch { return true; }
  });
  const toggleTranslit = () => setShowTranslit(prev => {
    try { localStorage.setItem(SHOW_TRANSLIT_KEY, prev ? '0' : '1'); } catch { /* stockage indisponible */ }
    return !prev;
  });
  const translit = showTranslit ? transliteration?.trim() : '';
  const listRef = useRef<HTMLDivElement>(null);

  // Livres → versets (un verset une seule fois, avec son nombre d'occurrences)
  const groups = useMemo(() => {
    const byBook = new Map<string, { dbCode: string; name: string; order: number; count: number; verses: Map<string, { chapter: number; verse: number; ref: string; count: number }> }>();
    occurrences.forEach(o => {
      const group = byBook.get(o.dbCode) ?? { dbCode: o.dbCode, name: o.bookName, order: o.bookOrder, count: 0, verses: new Map() };
      group.count++;
      const verse = group.verses.get(o.referenceCode) ?? { chapter: o.chapter, verse: o.verse, ref: o.referenceCode, count: 0 };
      verse.count++;
      group.verses.set(o.referenceCode, verse);
      byBook.set(o.dbCode, group);
    });
    return Array.from(byBook.values())
      .sort((a, b) => a.order - b.order)
      .map(g => ({ ...g, verses: Array.from(g.verses.values()).sort((a, b) => a.chapter - b.chapter || a.verse - b.verse) }));
  }, [occurrences]);
  const verseCount = groups.reduce((sum, g) => sum + g.verses.length, 0);

  // Textes Louis Segond des versets
  useEffect(() => {
    let cancelled = false;
    setTexts(null);
    getLsgVerseTexts(groups.flatMap(g => g.verses.map(v => v.ref)))
      .then(found => { if (!cancelled) setTexts(found); })
      .catch(err => { console.error('Error loading verse texts:', err); if (!cancelled) setTexts(new Map()); });
    return () => { cancelled = true; };
  }, [groups]);

  const regex = useMemo(() => {
    const terms = [...new Set(words.filter(Boolean))].sort((a, b) => b.length - a.length).map(w => escapeRegExp(w).replace(/\s+/g, '\\s+'));
    return terms.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
  }, [words]);
  const highlight = (text: string) => {
    if (!regex) return text;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(regex)) {
      nodes.push(text.slice(last, match.index));
      nodes.push(<mark key={match.index} className="bg-transparent font-bold text-blue-700 dark:text-blue-300">{match[0]}</mark>);
      if (translit) nodes.push(<span key={`t${match.index}`} className="italic text-amber-700 dark:text-amber-400"> ({translit})</span>);
      last = match.index! + match[0].length;
    }
    nodes.push(text.slice(last));
    return nodes;
  };

  const scrollToBook = (dbCode: string) => {
    const target = listRef.current?.querySelector<HTMLElement>(`[data-term-book="${dbCode}"]`);
    if (target && listRef.current) listRef.current.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-300/60 dark:border-amber-800 overflow-hidden font-cambria">
      {/* En-tête : mot ou code, totaux, fermeture */}
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300/50 dark:border-amber-800">
        <BookOpenText className="w-4 h-4 text-amber-700 dark:text-amber-400" />
        <span className="text-[16px] font-bold text-amber-900 dark:text-amber-200">{title}</span>
        <span className="text-[12px] text-muted-foreground">
          {formatCount(occurrences.length)} occurrence{occurrences.length > 1 ? 's' : ''} · {formatCount(verseCount)} verset{verseCount > 1 ? 's' : ''} · {groups.length} livre{groups.length > 1 ? 's' : ''} · {versionLabel}
        </span>
        {transliteration && (
          <button
            onClick={toggleTranslit}
            aria-pressed={showTranslit}
            className={`ml-auto p-1 rounded transition-colors ${showTranslit ? 'bg-amber-200/80 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100' : 'text-muted-foreground hover:bg-amber-100 dark:hover:bg-amber-900/40'}`}
            title={showTranslit ? 'Masquer le mot translittéré' : `Afficher le mot translittéré (${transliteration}) après chaque mot`}
          >
            <Languages className="w-4 h-4" />
          </button>
        )}
        <button onClick={onClose} className={`${transliteration ? '' : 'ml-auto '}p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40`} title="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,4fr)_minmax(0,1fr)]">
        {/* Versets (80 %) */}
        <div ref={listRef} className="relative max-h-[65vh] overflow-y-auto overscroll-contain thin-scrollbar px-4 pb-3">
          {groups.map(group => (
            <section key={group.dbCode} data-term-book={group.dbCode}>
              <h4 className="sticky top-0 z-10 -mx-4 px-4 py-1.5 bg-card/95 backdrop-blur border-b border-amber-300/40 flex items-baseline gap-2">
                <span className="text-[16px] font-bold text-amber-800 dark:text-amber-300">{group.name}</span>
                <span className="text-[12px] text-muted-foreground">{formatCount(group.count)}</span>
              </h4>
              <ul className="mt-2 mb-3 space-y-[10px]">
                {group.verses.map(v => (
                  <li key={v.ref}>
                    {/* Clic = page Lecture, sur ce verset */}
                    <Link
                      to={`/bible?ref=${v.ref}`}
                      title={`Lire ${group.name} ${v.chapter}:${v.verse}`}
                      className="group block -mx-2 px-2 py-0.5 rounded-md text-foreground hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                    >
                    <span className="block text-[13px] leading-tight font-bold tabular-nums text-amber-700 dark:text-amber-400 group-hover:underline">
                      {group.name} {v.chapter}:{v.verse}
                      {v.count > 1 && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">×{v.count}</span>}
                    </span>
                    <span className="block text-[15px] leading-snug">
                      {texts === null
                        ? <span className="text-muted-foreground">…</span>
                        : texts.has(v.ref) ? highlight(texts.get(v.ref)!) : <span className="italic text-muted-foreground">Texte non disponible</span>}
                    </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {texts === null && (
            <div className="sticky bottom-0 py-1 flex items-center gap-2 text-[12px] text-muted-foreground bg-card/90">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Chargement des textes…
            </div>
          )}
        </div>

        {/* Livres et nombre d'occurrences (20 %) */}
        <aside className="max-h-[65vh] overflow-y-auto overscroll-contain thin-scrollbar border-t md:border-t-0 md:border-l border-border bg-muted/20">
          <div className="sticky top-0 px-3 py-1.5 flex items-center justify-between gap-2 bg-muted/90 backdrop-blur border-b border-border">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{groups.length} livre{groups.length > 1 ? 's' : ''}</span>
            <span className="text-[13px] font-bold tabular-nums text-amber-800 dark:text-amber-300">{formatCount(occurrences.length)}</span>
          </div>
          <ul className="py-1">
            {groups.map(group => (
              <li key={group.dbCode}>
                <button
                  onClick={() => scrollToBook(group.dbCode)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1 text-left text-[13px] hover:bg-amber-100/70 dark:hover:bg-amber-900/30"
                >
                  <span className="font-bold truncate">{group.name}</span>
                  <span className="text-[11px] font-bold tabular-nums text-amber-700 dark:text-amber-400">{formatCount(group.count)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
};
