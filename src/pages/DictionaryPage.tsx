import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/bible/Navbar';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  AlertCircle,
  RefreshCw,
  X,
  CornerDownRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import {
  getDictionaries,
  getDictionaryEntries,
  getAvailableLetters,
  getDictionaryEntryCounts,
  entryInitial,
  Dictionary,
  DictionaryEntry,
} from '@/services/dictionaryDb';
import { dictionaryExcerpt, isCrossReferenceOnly } from '@/utils/dictionaryHtml';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Pagination compacte : ‹ 1 … 4 5 6 … 19 › */
const Pagination: React.FC<{ page: number; total: number; onChange: (page: number) => void }> = ({ page, total, onChange }) => {
  if (total <= 1) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(p => p === 1 || p === total || Math.abs(p - page) <= 1);
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-30"
        title="Page précédente"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <button
            onClick={() => onChange(p)}
            className={`min-w-8 h-8 px-2 rounded-full text-[13px] font-semibold tabular-nums transition-colors ${
              p === page ? 'bg-amber-700 text-white shadow' : 'hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }`}
          >
            {p}
          </button>
        </React.Fragment>
      ))}
      <button
        onClick={() => onChange(Math.min(total, page + 1))}
        disabled={page === total}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-30"
        title="Page suivante"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

const DictionaryPage: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [entryCounts, setEntryCounts] = useState<Map<number, number>>(new Map());
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);

  // Filter state
  const [selectedDictionary, setSelectedDictionary] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 100;

  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDictionaries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dicts = await getDictionaries();
      setDictionaries(dicts);
      const counts = await getDictionaryEntryCounts(dicts.map(d => d.id));
      setEntryCounts(counts);

      // Premier dictionnaire non vide par défaut
      const first = dicts.find(d => (counts.get(d.id) ?? 0) > 0) ?? dicts[0];
      if (first) setSelectedDictionary(prev => prev ?? first.id);

      if (dicts.length === 0) {
        setError('Aucun dictionnaire trouvé dans la base de données.');
      }
    } catch (err) {
      console.error('Error loading dictionaries:', err);
      setError('Impossible de charger les dictionnaires.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDictionaries();
  }, [loadDictionaries]);

  // Load entries when filters change
  const loadEntries = useCallback(async () => {
    if (!selectedDictionary) return;

    setLoadingEntries(true);
    setError(null);
    try {
      const response = await getDictionaryEntries({
        dictionaryId: selectedDictionary,
        searchQuery: searchQuery,
        letter: selectedLetter || undefined,
        page: currentPage,
        pageSize
      });

      setEntries(response.entries);
      setTotalCount(response.totalCount);
      setTotalPages(response.totalPages);
    } catch (err) {
      console.error('Error loading entries:', err);
      setError('Erreur lors du chargement des entrées.');
    } finally {
      setLoadingEntries(false);
    }
  }, [selectedDictionary, searchQuery, selectedLetter, currentPage]);

  // Load available letters when dictionary changes
  useEffect(() => {
    if (!selectedDictionary) return;
    getAvailableLetters(selectedDictionary)
      .then(setAvailableLetters)
      .catch(err => console.error('Error loading letters:', err));
    setSelectedLetter(null); // Reset letter filter when dictionary changes
    setCurrentPage(1);
  }, [selectedDictionary]);

  useEffect(() => {
    if (selectedDictionary) {
      loadEntries();
    }
  }, [selectedDictionary, searchQuery, selectedLetter, currentPage, loadEntries]);

  const handleLetterClick = (letter: string) => {
    setSelectedLetter(prev => (prev === letter ? null : letter));
    setSearchQuery('');
    setCurrentPage(1);
  };

  const changePage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentDictionary = dictionaries.find(d => d.id === selectedDictionary);

  // Entrées regroupées par lettre initiale, comme dans un dictionnaire imprimé
  const groups = useMemo(() => {
    const result: { letter: string; items: { entry: DictionaryEntry; excerpt: string; crossRef: boolean }[] }[] = [];
    entries.forEach(entry => {
      const letter = entryInitial(entry.entry_name) || '#';
      const item = { entry, excerpt: dictionaryExcerpt(entry.content), crossRef: isCrossReferenceOnly(entry.content) };
      const last = result[result.length - 1];
      if (last && last.letter === letter) last.items.push(item);
      else result.push({ letter, items: [item] });
    });
    return result;
  }, [entries]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar currentVersion="LSG" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto" />
            <p className="text-muted-foreground">Chargement du dictionnaire...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && dictionaries.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar currentVersion="LSG" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4 space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <h1 className="text-xl font-bold">Erreur de chargement</h1>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              Vérifiez que les tables <code className="px-1 py-0.5 rounded bg-muted">dictionaries</code> et <code className="px-1 py-0.5 rounded bg-muted">dictionary_entries</code> existent dans Supabase et que les permissions RLS sont configurées.
            </p>
            <Button onClick={loadDictionaries} className="rounded-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar currentVersion="LSG" />

      {/* En-tête */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C] text-white">
        <span
          aria-hidden
          className="pointer-events-none select-none absolute right-4 -bottom-24 font-cambria font-bold text-[18rem] leading-none text-white/[0.06]"
        >
          {selectedLetter || 'Aa'}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />

        <div className="relative px-[10px] sm:px-8 pt-6 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-200/90">Dictionnaire biblique</p>
          <h1 className="mt-1 font-cambria text-[30px] sm:text-[40px] font-bold leading-tight">
            {currentDictionary?.name ?? 'Dictionnaire'}
          </h1>
          {currentDictionary && (
            <p className="mt-1 text-[13px] text-amber-100/80">
              {currentDictionary.author && <>par <span className="font-semibold text-amber-50">{currentDictionary.author}</span> · </>}
              {(entryCounts.get(currentDictionary.id) ?? 0).toLocaleString('fr-FR')} entrées
            </p>
          )}

          {/* Choix du dictionnaire */}
          <div className="mt-5 flex flex-wrap gap-2">
            {dictionaries.map(dict => {
              const count = entryCounts.get(dict.id) ?? 0;
              const active = dict.id === selectedDictionary;
              return (
                <button
                  key={dict.id}
                  onClick={() => count > 0 && setSelectedDictionary(dict.id)}
                  disabled={count === 0}
                  className={`group flex items-center gap-2 pl-3 pr-2 h-9 rounded-full border text-[13px] font-semibold transition-all ${
                    active
                      ? 'bg-amber-50 text-amber-900 border-amber-50 shadow-lg shadow-black/20'
                      : count > 0
                        ? 'border-white/30 text-white hover:bg-white/10'
                        : 'border-white/15 text-white/45 cursor-not-allowed'
                  }`}
                  title={dict.description}
                >
                  <span>{dict.author || dict.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] tabular-nums ${
                    active ? 'bg-amber-200/70 text-amber-900' : 'bg-white/15'
                  }`}>
                    {count > 0 ? count.toLocaleString('fr-FR') : 'à venir'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Barre de recherche et alphabet */}
      <div className="sticky top-[40px] z-30 bg-[#B45309] dark:bg-[#292524] text-white shadow-md shadow-black/10">
        <div className="px-[10px] sm:px-8 min-h-[38px] py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center h-[26px] rounded-md bg-white/15 w-full sm:w-72">
            <Search className="w-3.5 h-3.5 ml-2 shrink-0 text-white/80" />
            <input
              type="text"
              placeholder="Rechercher un terme…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedLetter(null);
                setCurrentPage(1);
              }}
              className="flex-1 min-w-0 bg-transparent px-2 text-[13px] outline-none placeholder:text-white/60"
              disabled={dictionaries.length === 0}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="mr-1 p-0.5 rounded hover:bg-white/10" title="Effacer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {ALPHABET.map(letter => {
              const isAvailable = availableLetters.includes(letter);
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  onClick={() => isAvailable && handleLetterClick(letter)}
                  disabled={!isAvailable}
                  className={`shrink-0 w-[24px] h-[26px] rounded font-cambria text-[15px] font-bold transition-colors ${
                    isSelected
                      ? 'bg-amber-50 text-amber-900'
                      : isAvailable
                        ? 'text-white hover:bg-white/15'
                        : 'text-white/30 cursor-not-allowed'
                  }`}
                  title={isAvailable ? `Mots commençant par ${letter}` : `Aucun mot par ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="flex-1 w-full px-[10px] sm:px-8 py-5">
        {/* Résultats et pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p className="text-[13px] text-muted-foreground">
            {loadingEntries ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</span>
            ) : (
              <>
                <strong className="font-cambria text-[18px] text-foreground">{totalCount.toLocaleString('fr-FR')}</strong>{' '}
                entrée{totalCount > 1 ? 's' : ''}
                {selectedLetter && <> commençant par <strong className="text-amber-700 dark:text-amber-400">{selectedLetter}</strong></>}
                {searchQuery && <> contenant « <strong className="text-foreground">{searchQuery}</strong> »</>}
                {totalPages > 1 && <> · page {currentPage} sur {totalPages}</>}
              </>
            )}
          </p>
          {!loadingEntries && <Pagination page={currentPage} total={totalPages} onChange={changePage} />}
        </div>

        {loadingEntries ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-3" />
            <span className="text-sm font-medium">Chargement des entrées…</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto opacity-40 mb-3" />
            <p className="font-cambria text-[18px] text-foreground">
              {searchQuery || selectedLetter ? 'Aucune entrée trouvée' : 'Ce dictionnaire est vide'}
            </p>
            <p className="text-xs mt-1">
              {searchQuery || selectedLetter ? 'Essayez un autre terme ou une autre lettre.' : 'Choisissez un autre dictionnaire ci-dessus.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(group => (
              <section key={`${group.letter}-${group.items[0].entry.id}`}>
                {/* Lettrine de section */}
                <div className="flex items-end gap-3 mb-3">
                  <span className="font-cambria text-[44px] font-bold leading-none text-amber-700 dark:text-amber-400">{group.letter}</span>
                  <span className="flex-1 h-px mb-2 bg-gradient-to-r from-amber-400/70 via-amber-300/40 to-transparent dark:from-amber-700/70" />
                  <span className="mb-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {group.items.length} entrée{group.items.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {group.items.map(({ entry, excerpt, crossRef }) => (
                    <button
                      key={entry.id}
                      onClick={() => navigate(`/dictionnaire/${selectedDictionary}/${entry.id}`)}
                      className="group relative text-left rounded-xl border border-border bg-card px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/10"
                    >
                      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <h3 className="font-cambria text-[18px] font-bold leading-snug text-foreground group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors line-clamp-1">
                        {entry.entry_name}
                      </h3>
                      {crossRef ? (
                        <p className="mt-1 flex items-center gap-1.5 font-cambria italic text-[14px] text-amber-800/80 dark:text-amber-300/80">
                          <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                          <span className="line-clamp-1">{excerpt}</span>
                        </p>
                      ) : (
                        <p className="mt-1 font-cambria text-[14px] leading-relaxed text-muted-foreground line-clamp-3">{excerpt}</p>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!loadingEntries && totalPages > 1 && (
          <div className="mt-10 flex justify-center">
            <Pagination page={currentPage} total={totalPages} onChange={changePage} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/20 py-8 mt-12">
        <div className="w-full px-[10px] sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-foreground">Dictionnaire Biblique</span>
          </div>
          <p className="text-center sm:text-right">
            Références : {dictionaries.map(d => d.author || d.name).join(', ')}
          </p>
        </div>
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default DictionaryPage;
