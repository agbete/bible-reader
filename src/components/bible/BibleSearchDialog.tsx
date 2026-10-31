import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Search, Loader2, X, CaseSensitive, BookOpen, ChevronRight } from 'lucide-react';
import type { DbBibleVersion, DbBookItem, DbLanguage } from '@/services/bibleDb';
import { versionDisplayCode } from '@/services/bibleDb';
import { buildHighlightRegex, searchBible, BibleSearchHit, SearchMatchMode } from '@/services/bibleSearch';
import { BookScopePicker } from '@/components/bible/BookScopePicker';
import { VersionScopePicker } from '@/components/bible/VersionScopePicker';

interface NamedGroup {
  id: number;
  name: string;
  testament_id?: number;
}

/** État de la recherche, enregistré dans l'historique de navigation (bouton Retour) */
export interface SearchDialogState {
  query: string;
  mode: SearchMatchMode;
  caseSensitive: boolean;
  /** null = toute la Bible */
  bookIds: number[] | null;
  versionCodes: string[];
  activeVersionId: number | null;
  scrollTop: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Toutes les versions disponibles : on peut chercher dans une ou plusieurs */
  versions: DbBibleVersion[];
  languages: DbLanguage[];
  /** Versions affichées sur la page (raccourci dans le sélecteur) */
  pageVersionCodes: string[];
  books: DbBookItem[];
  testaments: NamedGroup[];
  classifications: NamedGroup[];
  /** versionCode : version du résultat cliqué, à afficher sur la page */
  onSelectVerse: (book: DbBookItem, chapter: number, verse: number, versionCode?: string) => void;
  /** Appelé à chaque changement (texte, critères, livres, versions, onglet, défilement) */
  onStateChange?: (state: SearchDialogState) => void;
  /** État à rétablir à l'ouverture (retour arrière) ; onRestored est appelé une fois appliqué */
  restoreState?: SearchDialogState | null;
  onRestored?: () => void;
}

const MODES: { id: SearchMatchMode; label: string; hint: string }[] = [
  { id: 'contains', label: 'Contient', hint: 'Le texte apparaît n’importe où (« paix » trouve aussi « apaiser »)' },
  { id: 'word', label: 'Mot entier', hint: 'Le mot ou l’expression exacte, isolé' },
  { id: 'prefix', label: 'Préfixe', hint: 'Mots qui commencent par le texte (« béni » trouve « bénir », « bénit »)' },
  { id: 'suffix', label: 'Suffixe', hint: 'Mots qui se terminent par le texte (« ment » trouve « commandement »)' },
];

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const store = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
};

const formatCount = (n: number) => n.toLocaleString('fr-FR');

/** Version cherchée par défaut */
const DEFAULT_VERSION_CODES = ['LSG'];

export const BibleSearchDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  versions,
  languages,
  pageVersionCodes,
  books,
  testaments,
  classifications,
  onSelectVerse,
  onStateChange,
  restoreState,
  onRestored,
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMatchMode>(() => readStored('bible-search-mode', 'contains'));
  const [caseSensitive, setCaseSensitive] = useState<boolean>(() => readStored('bible-search-case', false));
  /** Livres où chercher (tous cochés par défaut) */
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const booksInitializedRef = useRef(false);
  /** Versions où chercher : LSG à chaque ouverture de la recherche */
  const [selectedVersionCodes, setSelectedVersionCodes] = useState<string[]>(DEFAULT_VERSION_CODES);
  useEffect(() => {
    if (!isOpen) return;
    if (restoreState) {
      setQuery(restoreState.query);
      setMode(restoreState.mode);
      setCaseSensitive(restoreState.caseSensitive);
      setSelectedVersionCodes(restoreState.versionCodes);
      if (restoreState.bookIds) {
        booksInitializedRef.current = true;
        setSelectedBookIds(new Set(restoreState.bookIds));
      } else if (books.length > 0) {
        setSelectedBookIds(new Set(books.map(b => b.id)));
      }
    } else {
      setSelectedVersionCodes(DEFAULT_VERSION_CODES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedKey, setSearchedKey] = useState<string | null>(null);
  const requestRef = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => store('bible-search-mode', mode), [mode]);
  useEffect(() => store('bible-search-case', caseSensitive), [caseSensitive]);

  /** Versions cochées, dans l'ordre de la liste */
  const searchVersions = useMemo(
    () => selectedVersionCodes
      .map(code => versions.find(v => v.code === code))
      .filter((v): v is DbBibleVersion => !!v),
    [selectedVersionCodes, versions]
  );
  const versionsById = useMemo(() => new Map(versions.map(v => [v.id, v])), [versions]);
  const versionIds = useMemo(() => searchVersions.map(v => v.id).sort((a, b) => a - b), [searchVersions]);
  const noVersionSelected = versions.length > 0 && searchVersions.length === 0;
  const booksById = useMemo(() => new Map(books.map(b => [b.id, b])), [books]);

  useEffect(() => {
    if (!booksInitializedRef.current && books.length > 0) {
      booksInitializedRef.current = true;
      setSelectedBookIds(new Set(books.map(b => b.id)));
    }
  }, [books]);

  /** Livres cochés (undefined = toute la Bible, sans filtre) */
  const scopeBookIds = useMemo(
    () => (selectedBookIds.size === books.length ? undefined : Array.from(selectedBookIds).sort((a, b) => a - b)),
    [selectedBookIds, books.length]
  );
  const noBookSelected = selectedBookIds.size === 0 && books.length > 0;

  const trimmed = query.trim();
  const searchKey = JSON.stringify([trimmed, mode, caseSensitive, versionIds, scopeBookIds]);
  const blocked = noBookSelected || noVersionSelected;

  // Recherche automatique (délai de saisie de 400 ms), relancée quand un critère change
  useEffect(() => {
    if (!isOpen || versionIds.length === 0 || trimmed.length < 2 || blocked) {
      if (trimmed.length < 2 || blocked) { setHits([]); setTotal(0); setSearchedKey(null); setError(null); }
      return;
    }
    const requestId = ++requestRef.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const response = await searchBible({ query: trimmed, versionIds, mode, caseSensitive, bookIds: scopeBookIds });
        if (requestId !== requestRef.current) return;
        setHits(response.hits);
        setTotal(response.total);
        setSearchedKey(searchKey);
        resultsRef.current?.scrollTo({ top: 0 });
      } catch (err) {
        console.error('[BibleSearch] Erreur:', err);
        if (requestId === requestRef.current) setError('La recherche a échoué. Réessayez avec un autre terme.');
      } finally {
        if (requestId === requestRef.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchKey]);

  // Plusieurs versions : un onglet par version (code), les résultats de l'onglet actif sont affichés
  const multiVersion = searchVersions.length > 1;
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  useEffect(() => {
    if (!searchVersions.some(v => v.id === activeVersionId)) setActiveVersionId(searchVersions[0]?.id ?? null);
  }, [searchVersions, activeVersionId]);
  // Résultats de la version affichée, organisés par livre puis par verset (ordre biblique)
  const grouped = useMemo(() => {
    const byBook = new Map<number, { book: DbBookItem; verses: BibleSearchHit[] }>();
    hits.forEach(hit => {
      if (multiVersion && hit.versionId !== activeVersionId) return;
      const book = booksById.get(hit.bookId);
      if (!book) return;
      let group = byBook.get(book.id);
      if (!group) {
        group = { book, verses: [] };
        byBook.set(book.id, group);
      }
      group.verses.push(hit);
    });
    return Array.from(byBook.values())
      .sort((a, b) => a.book.order_index - b.book.order_index)
      .map(g => ({
        ...g,
        count: g.verses.length,
        verses: g.verses.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse),
      }));
  }, [hits, booksById, multiVersion, activeVersionId]);
  const verseTotal = useMemo(() => grouped.reduce((sum, g) => sum + g.count, 0), [grouped]);
  const activeVersion = multiVersion ? versionsById.get(activeVersionId ?? -1) : searchVersions[0];

  // ─── Historique de navigation : état signalé à la page, et rétabli au retour ───
  useEffect(() => {
    if (isOpen && restoreState?.activeVersionId && searchVersions.some(v => v.id === restoreState.activeVersionId)) {
      setActiveVersionId(restoreState.activeVersionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, restoreState, searchVersions]);

  const reportState = () => {
    if (!isOpen || !onStateChange) return;
    onStateChange({
      query,
      mode,
      caseSensitive,
      bookIds: selectedBookIds.size === books.length ? null : Array.from(selectedBookIds),
      versionCodes: selectedVersionCodes,
      activeVersionId,
      scrollTop: resultsRef.current?.scrollTop ?? 0,
    });
  };
  const reportStateRef = useRef(reportState);
  reportStateRef.current = reportState;
  useEffect(() => {
    reportStateRef.current();
  }, [isOpen, query, mode, caseSensitive, selectedBookIds, selectedVersionCodes, activeVersionId]);

  // Défilement rétabli une fois les résultats de la recherche rétablie affichés
  useEffect(() => {
    if (!restoreState || !isOpen || searching || searchedKey !== searchKey) return;
    if (trimmed !== restoreState.query.trim()) return;
    if (restoreState.activeVersionId && multiVersion && activeVersionId !== restoreState.activeVersionId) return;
    const top = restoreState.scrollTop;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (resultsRef.current) resultsRef.current.scrollTop = top;
    }));
    onRestored?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreState, isOpen, searching, searchedKey, searchKey, activeVersionId]);

  const highlightRegex = useMemo(
    () => (searchedKey ? buildHighlightRegex(trimmed, mode, caseSensitive) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchedKey]
  );

  const highlight = (text: string) => {
    if (!highlightRegex) return text;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(highlightRegex)) {
      if (!match[0]) continue;
      nodes.push(text.slice(last, match.index));
      nodes.push(
        <mark key={match.index} className="bg-transparent font-bold text-blue-700 dark:text-blue-300">{match[0]}</mark>
      );
      last = match.index! + match[0].length;
    }
    nodes.push(text.slice(last));
    return nodes;
  };

  const scrollToBook = (bookId: number) => {
    document.getElementById(`search-book-${bookId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const upToDate = searchedKey === searchKey;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="font-cambria max-w-6xl w-[96vw] h-[88vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">Rechercher dans la Bible</DialogTitle>

        {/* Saisie */}
        <div ref={headerRef} className="bg-[#B45309] dark:bg-[#292524] text-white px-[10px] py-1.5">
          {/* Champ de recherche puis critères, sur une même ligne */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex-1 min-w-[14rem] flex items-center h-6 rounded-md bg-white/15 focus-within:bg-white/20 transition-colors">
              <Search className="w-3.5 h-3.5 ml-2 shrink-0 text-white/80" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Un mot ou une expression (ex. paix, lumière du monde, béni)…"
                className="flex-1 min-w-0 bg-transparent px-2 text-[13px] outline-none placeholder:text-white/60"
              />
              {searching && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              {query && !searching && (
                <button onClick={() => setQuery('')} className="mr-1 p-0.5 rounded hover:bg-white/15" title="Effacer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Portée : livres par testament et classement */}
            <BookScopePicker
              books={books}
              testaments={testaments}
              classifications={classifications}
              selected={selectedBookIds}
              onChange={setSelectedBookIds}
            />

            {/* Versions : une ou plusieurs */}
            <VersionScopePicker
              versions={versions}
              languages={languages}
              selected={selectedVersionCodes}
              onChange={setSelectedVersionCodes}
              pageVersionCodes={pageVersionCodes}
              anchorRef={headerRef}
            />

            <div className="flex items-center h-6 rounded-md bg-white/10 p-0.5">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  className={`h-5 px-2 rounded text-[12px] font-semibold transition-colors ${
                    mode === m.id ? 'bg-white text-amber-900 shadow' : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCaseSensitive(v => !v)}
              aria-pressed={caseSensitive}
              title="Respecter la casse (majuscules / minuscules)"
              className={`h-6 px-2 rounded-md border text-[12px] font-semibold flex items-center gap-1 transition-colors ${
                caseSensitive ? 'bg-white text-amber-900 border-white' : 'border-white/30 text-white/85 hover:bg-white/10'
              }`}
            >
              <CaseSensitive className="w-3.5 h-3.5" />
              Respecter la casse
            </button>

            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/15" title="Fermer (Échap)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Résultats */}
        <div className="flex-1 min-h-0 flex">
          {/* Livres trouvés : colonne toujours présente, même sans résultat */}
          <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-muted/20">
            {(() => {
              const ready = upToDate && !searching;
              const bookCount = ready ? grouped.length : 0;
              return (
                <>
                  {/* Nombre de livres ; total des occurrences tout à droite, aligné sur les nombres par livre */}
                  <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-border">
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      {bookCount} livre{bookCount > 1 ? 's' : ''}
                    </span>
                    {searching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    ) : (
                      <span className="text-[13px] font-bold tabular-nums text-amber-800 dark:text-amber-300" title="Total des occurrences (versets trouvés)">
                        {formatCount(ready ? verseTotal : 0)}
                      </span>
                    )}
                  </div>
                  <ul className="flex-1 overflow-y-auto thin-scrollbar py-1">
                    {ready && grouped.map(g => (
                      <li key={g.book.id}>
                        <button
                          onClick={() => scrollToBook(g.book.id)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-1 text-left text-[13px] hover:bg-amber-100/70 dark:hover:bg-amber-900/30"
                        >
                          <span className="font-cambria font-bold truncate">{g.book.name}</span>
                          <span className="text-[11px] font-bold tabular-nums text-amber-700 dark:text-amber-400">{formatCount(g.count)}</span>
                        </button>
                      </li>
                    ))}
                    {ready && grouped.length === 0 && trimmed.length >= 2 && (
                      <li className="px-3 py-2 font-cambria italic text-[13px] text-muted-foreground">Aucun résultat</li>
                    )}
                  </ul>
                </>
              );
            })()}
          </aside>

          <div ref={resultsRef} onScroll={() => reportStateRef.current()} className="flex-1 min-w-0 overflow-y-auto thin-scrollbar">
            {trimmed.length < 2 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
                <Search className="w-10 h-10 opacity-30 mb-3" />
                <p className="font-cambria text-[18px] text-foreground">Rechercher dans toute la Bible</p>
                <p className="text-[13px] mt-1 max-w-md">
                  Tapez au moins deux caractères. Affinez avec les critères (mot entier, préfixe, suffixe, casse) et limitez à un testament, un classement ou un livre.
                </p>
              </div>
            ) : noBookSelected ? (
              <p className="p-6 text-sm text-muted-foreground">Cochez au moins un livre dans « Dans » pour lancer la recherche.</p>
            ) : noVersionSelected ? (
              <p className="p-6 text-sm text-muted-foreground">Cochez au moins une version dans « Versions » pour lancer la recherche.</p>
            ) : searching || (!upToDate && !error) ? (
              /* Chargement des résultats */
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-9 h-9 animate-spin text-amber-600" />
                <p className="font-cambria text-[16px] text-foreground">Recherche de « {trimmed} »…</p>
                <p className="text-[12px]">
                  {searchVersions.map(v => versionDisplayCode(v)).join(', ')}
                  {scopeBookIds ? ` · ${scopeBookIds.length} livre${scopeBookIds.length > 1 ? 's' : ''}` : ' · toute la Bible'}
                </p>
              </div>
            ) : error ? (
              <p className="p-6 text-sm text-destructive">{error}</p>
            ) : upToDate && hits.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto opacity-30 mb-3" />
                <p className="font-cambria text-[18px] text-foreground">Aucun verset trouvé pour « {trimmed} »</p>
                <p className="text-[13px] mt-1">Essayez le mode « Contient », retirez « Respecter la casse » ou élargissez la portée.</p>
              </div>
            ) : (
              <div className="px-4 sm:px-6 pb-6">
                {/* Plusieurs versions : codes des versions choisies ; un clic affiche ses résultats */}
                {multiVersion && (
                  <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 h-[24px] flex items-center gap-1 overflow-x-auto no-scrollbar bg-amber-600 dark:bg-amber-800">
                    {searchVersions.map(v => {
                      const active = v.id === activeVersionId;
                      return (
                        <button
                          key={v.id}
                          onClick={() => { setActiveVersionId(v.id); resultsRef.current?.scrollTo({ top: 0 }); }}
                          title={v.name}
                          aria-pressed={active}
                          className={`shrink-0 h-[18px] px-2 rounded flex items-center gap-1.5 text-[12px] font-bold transition-colors ${
                            active ? 'bg-white text-amber-900 shadow' : 'text-white hover:bg-white/15'
                          }`}
                        >
                          {versionDisplayCode(v)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {multiVersion && upToDate && grouped.length === 0 && (
                  <p className="py-8 text-center font-cambria text-[16px] text-muted-foreground">
                    Aucun verset trouvé dans {activeVersion ? versionDisplayCode(activeVersion) : 'cette version'}.
                  </p>
                )}

                {grouped.map(g => (
                  <section key={g.book.id} id={`search-book-${g.book.id}`} className={multiVersion ? 'scroll-mt-[24px]' : 'scroll-mt-0'}>
                    <header className={`sticky ${multiVersion ? 'top-[24px]' : 'top-0'} z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-background/95 backdrop-blur border-b border-amber-300/50 dark:border-amber-800 flex items-baseline gap-2`}>
                      <h3 className="font-cambria text-[19px] font-bold text-amber-800 dark:text-amber-300">{g.book.name}</h3>
                      <span className="text-[12px] text-muted-foreground">
                        {formatCount(g.count)} verset{g.count > 1 ? 's' : ''}
                      </span>
                    </header>

                    <ul className="mt-3 space-y-[10px]">
                      {g.verses.map(hit => (
                        <li key={`${hit.verseId}-${hit.versionId}`}>
                          {/* Référence en haut, texte juste en dessous */}
                          <button
                            onClick={() => { onSelectVerse(g.book, hit.chapter, hit.verse, versionsById.get(hit.versionId)?.code); onClose(); }}
                            className="group w-full block text-left rounded-lg px-2 py-1 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                          >
                            <span className="flex items-center gap-1 font-cambria text-[13px] leading-tight font-bold tabular-nums text-amber-700 dark:text-amber-400">
                              {g.book.name} {hit.chapter}:{hit.verse}
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                            <span className="block font-cambria text-[15px] leading-snug">{highlight(hit.text)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pied */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <span>
            {upToDate && hits.length > 0 && (
              <>
                <strong className="text-foreground">{formatCount(verseTotal)}</strong> verset{verseTotal > 1 ? 's' : ''} dans{' '}
                <strong className="text-foreground">{grouped.length}</strong> livre{grouped.length > 1 ? 's' : ''}
                {activeVersion && <>{' · '}{versionDisplayCode(activeVersion)}</>}
              </>
            )}
          </span>
          <span className="hidden sm:inline">Cliquez sur un verset pour l’ouvrir · Échap pour fermer</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
