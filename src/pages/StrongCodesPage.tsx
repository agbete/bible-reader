import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/bible/Navbar';
import { ChevronLeft, ChevronRight, Loader2, Search, X, AlertCircle, Sprout, Languages, ScrollText, BarChart3 } from 'lucide-react';
import { StrongOccurrences } from '@/components/strong/StrongOccurrences';
import {
  StrongCode,
  STRONG_MAX_CODE,
  getStrongCode,
  getStrongCodesRange,
  searchStrongCodes,
  sanitizeStrongHtml,
  strongSummary,
  parseStrongTranslations,
  parseStrongTransliteration,
  parseStrongOrigin,
} from '@/services/strongDb';

const RANGE_SIZE = 100;
const RANGE_COUNT = Math.ceil(STRONG_MAX_CODE / RANGE_SIZE);
/** Nombre de traductions affichées en barres (les autres en pastilles) */
const TOP_TRANSLATIONS = 6;

const rangeOf = (code: number) => Math.floor((code - 1) / RANGE_SIZE);
const rangeLabel = (index: number) =>
  `${index * RANGE_SIZE + 1} – ${Math.min((index + 1) * RANGE_SIZE, STRONG_MAX_CODE)}`;
const formatCount = (n: number) => n.toLocaleString('fr-FR');

/** Résumé d'une ligne de liste : les premières traductions, sinon la première définition */
const listSummary = (item: StrongCode) => {
  if (item.traduction_generale) {
    const terms = parseStrongTranslations(item.traduction_generale).terms.slice(0, 4).map(t => t.term);
    if (terms.length) return terms.join(', ');
  }
  return strongSummary(item.content);
};

/** tone="dark" : titre posé sur le fond foncé de la carte du code */
const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode; tone?: 'light' | 'dark' }> = ({ icon, children, aside, tone = 'light' }) => (
  <div className={`flex items-center gap-2 ${tone === 'dark' ? 'mb-2' : 'mb-3'}`}>
    <span className={tone === 'dark' ? 'text-amber-300' : 'text-amber-700 dark:text-amber-400'}>{icon}</span>
    <h3 className={`text-[11px] font-bold uppercase tracking-[0.2em] ${tone === 'dark' ? 'text-amber-200' : 'text-amber-800 dark:text-amber-300'}`}>{children}</h3>
    <span className={`flex-1 h-px bg-gradient-to-r to-transparent ${tone === 'dark' ? 'from-amber-200/40' : 'from-amber-300/70 dark:from-amber-700/60'}`} />
    {aside}
  </div>
);

const StrongCodesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCode = Math.min(
    STRONG_MAX_CODE,
    Math.max(1, parseInt(searchParams.get('code') || '1', 10) || 1)
  );

  const [rangeIndex, setRangeIndex] = useState(rangeOf(currentCode));
  const [rangeItems, setRangeItems] = useState<StrongCode[]>([]);
  const [loadingRange, setLoadingRange] = useState(false);

  const [entry, setEntry] = useState<StrongCode | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StrongCode[] | null>(null);
  const [searching, setSearching] = useState(false);

  const selectCode = (code: number) => {
    const next = Math.min(STRONG_MAX_CODE, Math.max(1, code));
    setSearchParams({ code: String(next) });
  };

  // La liste suit le code affiché
  useEffect(() => {
    setRangeIndex(rangeOf(currentCode));
  }, [currentCode]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRange(true);
    const from = rangeIndex * RANGE_SIZE + 1;
    getStrongCodesRange(from, Math.min(from + RANGE_SIZE - 1, STRONG_MAX_CODE))
      .then(rows => { if (!cancelled) setRangeItems(rows); })
      .catch(err => { console.error('Error loading Strong codes:', err); if (!cancelled) setError('Impossible de charger les codes Strong.'); })
      .finally(() => { if (!cancelled) setLoadingRange(false); });
    return () => { cancelled = true; };
  }, [rangeIndex]);

  useEffect(() => {
    let cancelled = false;
    setLoadingEntry(true);
    setError(null);
    getStrongCode(String(currentCode))
      .then(row => { if (!cancelled) setEntry(row); })
      .catch(err => { console.error('Error loading Strong code:', err); if (!cancelled) setError('Impossible de charger ce code Strong.'); })
      .finally(() => { if (!cancelled) setLoadingEntry(false); });
    return () => { cancelled = true; };
  }, [currentCode]);

  // Garde le code sélectionné visible dans la liste
  useEffect(() => {
    document.getElementById(`strong-item-${currentCode}`)?.scrollIntoView({ block: 'nearest' });
  }, [currentCode, rangeItems]);

  // Un numéro (avec ou sans H) ouvre le code ; un mot cherche dans les définitions
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) { setSearchResults(null); return; }
    const number = term.match(/^[hH]?\s*(\d+)$/);
    if (number) {
      selectCode(parseInt(number[1], 10));
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      setSearchResults(await searchStrongCodes(term));
    } catch (err) {
      console.error('Error searching Strong codes:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => { setQuery(''); setSearchResults(null); };

  const listItems = searchResults ?? rangeItems;
  const summaries = useMemo(
    () => new Map(listItems.map(item => [item.code, listSummary(item)])),
    [listItems]
  );

  const entryHtml = useMemo(() => (entry ? sanitizeStrongHtml(entry.content) : ''), [entry]);
  const translit = useMemo(
    () => (entry?.mot_hebreu_translitere ? parseStrongTransliteration(entry.mot_hebreu_translitere) : null),
    [entry]
  );
  const translations = useMemo(
    () => (entry?.traduction_generale ? parseStrongTranslations(entry.traduction_generale) : null),
    [entry]
  );
  const origin = useMemo(() => (entry?.origine_mot ? parseStrongOrigin(entry.origine_mot) : null), [entry]);

  const countedTerms = translations?.terms.filter(t => t.count !== null).slice(0, TOP_TRANSLATIONS) ?? [];
  const otherTerms = translations?.terms.filter(t => !countedTerms.includes(t)) ?? [];
  const barBase = translations?.total || Math.max(1, ...countedTerms.map(t => t.count!));

  const hasSideSections = !loadingEntry && !!entry && (!!origin || !!translations?.terms.length);

  const neighbour = (code: number) => rangeItems.find(item => Number(item.code) === code);
  const prevEntry = neighbour(currentCode - 1);
  const nextEntry = neighbour(currentCode + 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Barre de contrôle */}
      <div className="sticky top-[40px] z-30 bg-[#B45309] dark:bg-[#292524] text-white">
        <div className="px-[10px] min-h-[30px] py-1 xl:py-0 flex flex-wrap items-center gap-2">
          <h1 className="text-[15px] font-bold mr-2">Codes Strong</h1>

          {/* Plage de codes */}
          <div className="flex items-center h-[24px] rounded-md bg-white/15">
            <button
              onClick={() => setRangeIndex(i => Math.max(0, i - 1))}
              disabled={rangeIndex === 0 || !!searchResults}
              className="px-1 h-full disabled:opacity-40 hover:bg-white/10 rounded-l-md"
              title="Plage précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={rangeIndex}
              onChange={e => { clearSearch(); setRangeIndex(Number(e.target.value)); }}
              className="bg-transparent text-[13px] font-semibold outline-none cursor-pointer px-1 [&>option]:text-foreground [&>option]:bg-background"
            >
              {Array.from({ length: RANGE_COUNT }, (_, i) => (
                <option key={i} value={i}>{rangeLabel(i)}</option>
              ))}
            </select>
            <button
              onClick={() => setRangeIndex(i => Math.min(RANGE_COUNT - 1, i + 1))}
              disabled={rangeIndex === RANGE_COUNT - 1 || !!searchResults}
              className="px-1 h-full disabled:opacity-40 hover:bg-white/10 rounded-r-md"
              title="Plage suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Recherche */}
          <form onSubmit={handleSearch} className="flex items-center h-[24px] rounded-md bg-white/15 flex-1 min-w-[12rem] max-w-md">
            <Search className="w-3.5 h-3.5 ml-2 shrink-0 text-white/80" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Numéro (430), mot (père) ou translittération (elohiym)"
              className="flex-1 min-w-0 bg-transparent px-2 text-[13px] outline-none placeholder:text-white/60"
            />
            {searching && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            {(query || searchResults) && !searching && (
              <button type="button" onClick={clearSearch} className="mr-1 p-0.5 rounded hover:bg-white/10" title="Effacer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      </div>

      <main className="px-[10px] py-[10px] grid gap-[18px] lg:grid-cols-[minmax(18rem,1fr)_2.2fr]">
        {/* Liste */}
        <section className="lg:sticky lg:top-[80px] lg:h-[calc(100vh-90px)] flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>
              {searchResults
                ? `${searchResults.length}${searchResults.length === 200 ? '+' : ''} résultat${searchResults.length > 1 ? 's' : ''} pour « ${query.trim()} »`
                : `Codes ${rangeLabel(rangeIndex)}`}
            </span>
            {loadingRange && !searchResults && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          </div>
          <ul className="flex-1 overflow-y-auto thin-scrollbar max-h-[40vh] lg:max-h-none">
            {listItems.map(item => {
              const code = Number(item.code);
              const active = code === currentCode;
              return (
                <li key={item.code} id={`strong-item-${code}`}>
                  <button
                    onClick={() => selectCode(code)}
                    className={`w-full text-left pl-3 pr-2 py-1.5 flex items-center gap-2 border-b border-border/50 border-l-[3px] transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-900/30 border-l-amber-600'
                        : 'border-l-transparent hover:bg-muted/60'
                    }`}
                  >
                    <span className={`shrink-0 w-12 font-bold text-[13px] ${active ? 'text-amber-800 dark:text-amber-300' : 'text-amber-700 dark:text-amber-400'}`}>
                      H{code}
                    </span>
                    <span className="flex-1 min-w-0 text-[13px] truncate">{summaries.get(item.code)}</span>
                    {item.mot_hebreu_original && (
                      <span dir="rtl" lang="he" className="shrink-0 font-hebrew text-[18px] leading-none text-stone-700 dark:text-stone-200">
                        {item.mot_hebreu_original}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {!loadingRange && listItems.length === 0 && (
              <li className="px-3 py-6 text-sm text-center text-muted-foreground">
                {searchResults ? 'Aucun résultat.' : 'Aucun code disponible.'}
              </li>
            )}
          </ul>
        </section>

        {/* Fiche du code */}
        <div className="flex flex-col gap-[18px] min-w-0">
          {/* En-tête : mot hébreu */}
          {/* Carte du code : mot hébreu à gauche ; Origine puis Traductions à droite */}
          <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C] text-white shadow-xl shadow-amber-900/20">
            {/* Filigrane */}
            {entry?.mot_hebreu_original && (
              <span
                aria-hidden
                dir="rtl"
                className="pointer-events-none select-none absolute -left-6 -bottom-16 font-hebrew text-[10rem] leading-none text-white/[0.06]"
              >
                {entry.mot_hebreu_original}
              </span>
            )}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

            <div className="relative px-5 sm:px-6 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-0.5 rounded-full border border-amber-300/60 text-amber-100 text-[11px] font-bold uppercase tracking-[0.2em]">
                  Strong · H{currentCode}
                </span>
                {entry?.type_mot && (
                  <span className="px-3 py-0.5 rounded-full bg-white/15 text-[12px] font-semibold">{entry.type_mot}</span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => selectCode(currentCode - 1)}
                    disabled={currentCode <= 1}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                    title="Code précédent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => selectCode(currentCode + 1)}
                    disabled={currentCode >= STRONG_MAX_CODE}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                    title="Code suivant"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {loadingEntry ? (
                <div className="min-h-[8rem] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-200" />
                </div>
              ) : (
                <div className={`grid gap-x-6 gap-y-4 pt-2 ${hasSideSections ? 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}>
                  {/* Mot hébreu */}
                  <div className="flex flex-col items-center justify-center text-center">
                    {entry?.mot_hebreu_original ? (
                      <p dir="rtl" lang="he" className="font-hebrew text-[48px] sm:text-[60px] leading-[1.1] text-amber-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
                        {entry.mot_hebreu_original}
                      </p>
                    ) : (
                      <p className="font-cambria text-[44px] leading-tight text-amber-50/90">H{currentCode}</p>
                    )}
                    {translit && (
                      <p className="mt-1 font-cambria italic text-[20px] sm:text-[22px] text-white">{translit.word}</p>
                    )}
                    {translit?.pronunciation && (
                      <p className="mt-0.5 text-[13px] tracking-[0.15em] text-amber-200">/ {translit.pronunciation} /</p>
                    )}

                    {translations && (translations.total !== null || translations.terms.length > 0) && (
                      <div className="mt-3 pt-2 border-t border-amber-200/25 flex items-stretch justify-center gap-8 sm:gap-10">
                        {translations.total !== null && (
                          <div>
                            <div className="font-cambria text-[22px] font-bold leading-none text-amber-100">{formatCount(translations.total)}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-200/80">occurrences</div>
                          </div>
                        )}
                        <div>
                          <div className="font-cambria text-[22px] font-bold leading-none text-amber-100">{translations.terms.length}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                            traduction{translations.terms.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Origine puis Traductions, à droite dans la carte */}
                  {hasSideSections && (
                    <div className="flex flex-col gap-4 min-w-0 pt-3 xl:pt-0 xl:pl-6 border-t xl:border-t-0 xl:border-l border-amber-200/25">
                      {origin && (
                        <section>
                          <SectionTitle tone="dark" icon={<Sprout className="w-4 h-4" />}>Origine</SectionTitle>
                          <p className="font-cambria text-[16px] leading-relaxed text-amber-50">
                            {origin.map((part, i) =>
                              typeof part === 'string' ? (
                                <span key={i}>{part}</span>
                              ) : (
                                <button
                                  key={i}
                                  onClick={() => selectCode(part.code)}
                                  className="mx-0.5 px-2 py-px rounded-full bg-white/15 text-amber-100 text-[13px] font-bold not-italic hover:bg-white/25 transition-colors align-baseline"
                                  title={`Ouvrir le code H${part.code}`}
                                >
                                  H{part.code}
                                </button>
                              )
                            )}
                          </p>
                        </section>
                      )}

                      {translations && translations.terms.length > 0 && (
                        <section>
                          <SectionTitle tone="dark" icon={<Languages className="w-4 h-4" />}>Traductions</SectionTitle>
                          {countedTerms.length > 0 && (
                            <ul className="space-y-1.5 mb-2.5">
                              {countedTerms.map(t => (
                                <li key={t.term} className="grid grid-cols-[minmax(5rem,auto)_1fr_auto] items-center gap-3">
                                  <span className="font-cambria text-[15px] font-semibold text-amber-50">{t.term}</span>
                                  <span className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                                    <span
                                      className="block h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-400"
                                      style={{ width: `${Math.max(2, Math.min(100, (t.count! / barBase) * 100))}%` }}
                                    />
                                  </span>
                                  <span className="text-[13px] font-bold tabular-nums text-amber-200">{formatCount(t.count!)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {otherTerms.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {otherTerms.map(t => (
                                <span
                                  key={t.term}
                                  className="px-2.5 py-0.5 rounded-full border border-white/25 bg-white/10 font-cambria text-[14px] text-amber-50"
                                >
                                  {t.term}
                                  {t.count !== null && <span className="ml-1 text-[11px] font-bold text-amber-200">{t.count}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm px-1">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {!loadingEntry && entry && (
            <>

              {/* Définition */}
              <section className="rounded-xl border border-border bg-card px-5 sm:px-8 py-5">
                <SectionTitle icon={<ScrollText className="w-4 h-4" />}>Définition</SectionTitle>
                <div
                  className="strong-content font-cambria text-[17px] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: entryHtml }}
                />
              </section>

              {/* Occurrences par livre */}
              <StrongOccurrences
                code={currentCode}
                renderTitle={aside => (
                  <SectionTitle icon={<BarChart3 className="w-4 h-4" />} aside={aside}>Occurrences dans la Bible</SectionTitle>
                )}
              />

              {/* Codes voisins */}
              <nav className="grid grid-cols-2 gap-[18px]">
                {currentCode > 1 ? (
                  <button
                    onClick={() => selectCode(currentCode - 1)}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-amber-400 hover:shadow-md transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-amber-700 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="min-w-0">
                      <span className="block text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Précédent · H{currentCode - 1}</span>
                      {prevEntry?.mot_hebreu_original && (
                        <span dir="rtl" lang="he" className="block font-hebrew text-[20px] leading-tight">{prevEntry.mot_hebreu_original}</span>
                      )}
                    </span>
                  </button>
                ) : <span />}
                {currentCode < STRONG_MAX_CODE && (
                  <button
                    onClick={() => selectCode(currentCode + 1)}
                    className="group flex items-center justify-end gap-3 rounded-xl border border-border bg-card px-4 py-3 text-right hover:border-amber-400 hover:shadow-md transition-all"
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Suivant · H{currentCode + 1}</span>
                      {nextEntry?.mot_hebreu_original && (
                        <span dir="rtl" lang="he" className="block font-hebrew text-[20px] leading-tight">{nextEntry.mot_hebreu_original}</span>
                      )}
                    </span>
                    <ChevronRight className="w-5 h-5 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </nav>
            </>
          )}

          {!loadingEntry && !entry && !error && (
            <p className="text-sm text-muted-foreground px-1">Aucune définition pour ce code.</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default StrongCodesPage;
