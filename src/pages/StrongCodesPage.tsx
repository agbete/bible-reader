import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/bible/Navbar';
import { ChevronLeft, ChevronRight, Loader2, Search, X, AlertCircle, ScrollText, Languages, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { StrongTermVerses } from '@/components/strong/StrongTermVerses';
import { StrongCodeModal, StrongKey, StrongOriginalWord, StrongOriginText, useStrongReferenceClick } from '@/components/strong/StrongCodeModal';
import {
  StrongCode,
  StrongSerie,
  STRONG_MAX_CODES,
  STRONG_SERIES,
  neighbourStrongCode,
  parseStrongKey,
  getStrongCode,
  getStrongCodesRange,
  searchStrongCodes,
  sanitizeStrongHtml,
  strongSummary,
  parseStrongTranslations,
  parseStrongTransliteration,
  getStrongWordForms,
  StrongWordForm,
  getLsgVersion,
  LsgVersionInfo,
} from '@/services/strongDb';

const RANGE_SIZE = 100;
/** Colonnes de la liste : Code Strong · Mot translitéré · Mot original · Traduit par */
const LIST_COLUMNS = 'grid grid-cols-[3rem_6rem_4.5rem_minmax(0,1fr)]';
const rangeCount = (serie: StrongSerie) => Math.ceil(STRONG_MAX_CODES[serie] / RANGE_SIZE);

const rangeOf = (code: number) => Math.floor((code - 1) / RANGE_SIZE);
const rangeLabel = (serie: StrongSerie, index: number) =>
  `${serie}${index * RANGE_SIZE + 1} – ${serie}${Math.min((index + 1) * RANGE_SIZE, STRONG_MAX_CODES[serie])}`;
const formatCount = (n: number) => n.toLocaleString('fr-FR');

/** Mot translittéré sans les apostrophes (aleph, ayin…) au début ni à la fin : ’ab → ab */
const trimApostrophes = (word: string) => word.replace(/^['’‘ʼʾʿ`´]+|['’‘ʼʾʿ`´]+$/g, '');

/** Premier mot seulement (« ’ab, ’abba » → « ’ab ») */
const firstWord = (text: string) => text.trim().split(/[\s,;/]+/)[0] ?? '';

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
  // « ?code=G25 » (grec), « ?code=H430 » ou « ?code=430 » (hébreu)
  const urlKey = parseStrongKey(searchParams.get('code')) ?? { serie: 'H' as StrongSerie, code: 1 };
  const serie = urlKey.serie;
  const currentCode = Math.min(STRONG_MAX_CODES[serie], Math.max(1, urlKey.code));
  const currentLabel = `${serie}${currentCode}`;
  const RANGE_COUNT = rangeCount(serie);

  const [rangeIndex, setRangeIndex] = useState(rangeOf(currentCode));
  const [rangeItems, setRangeItems] = useState<StrongCode[]>([]);
  const [loadingRange, setLoadingRange] = useState(false);

  const [entry, setEntry] = useState<StrongCode | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StrongCode[] | null>(null);
  // Liste des codes (panneau de gauche) affichée ou masquée, choix mémorisé
  const [showList, setShowList] = useState<boolean>(() => {
    try { return localStorage.getItem('strong-show-list') !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('strong-show-list', String(showList)); } catch { /* stockage indisponible */ }
  }, [showList]);
  const [searching, setSearching] = useState(false);

  const selectCode = (code: number, nextSerie: StrongSerie = serie) => {
    const next = Math.min(STRONG_MAX_CODES[nextSerie], Math.max(1, code));
    setSearchParams({ code: `${nextSerie}${next}` });
  };

  // Autre série : on repart de son premier code, sans recherche en cours
  const selectSerie = (next: StrongSerie) => {
    if (next === serie) return;
    clearSearch();
    selectCode(1, next);
  };

  // La liste suit le code affiché
  useEffect(() => {
    setRangeIndex(rangeOf(currentCode));
  }, [currentCode, serie]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRange(true);
    const from = rangeIndex * RANGE_SIZE + 1;
    getStrongCodesRange(serie, from, Math.min(from + RANGE_SIZE - 1, STRONG_MAX_CODES[serie]))
      .then(rows => { if (!cancelled) setRangeItems(rows); })
      .catch(err => { console.error('Error loading Strong codes:', err); if (!cancelled) setError('Impossible de charger les codes Strong.'); })
      .finally(() => { if (!cancelled) setLoadingRange(false); });
    return () => { cancelled = true; };
  }, [serie, rangeIndex]);

  useEffect(() => {
    let cancelled = false;
    setLoadingEntry(true);
    setError(null);
    getStrongCode(serie, currentCode)
      .then(row => { if (!cancelled) setEntry(row); })
      .catch(err => { console.error('Error loading Strong code:', err); if (!cancelled) setError('Impossible de charger ce code Strong.'); })
      .finally(() => { if (!cancelled) setLoadingEntry(false); });
    return () => { cancelled = true; };
  }, [serie, currentCode]);

  // Garde le code sélectionné visible dans la liste
  useEffect(() => {
    document.getElementById(`strong-item-${currentCode}`)?.scrollIntoView({ block: 'nearest' });
  }, [currentCode, rangeItems]);

  // Un numéro (« 430 », « H430 », « G25 ») ouvre le code ; un mot cherche dans les définitions de la série
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) { setSearchResults(null); return; }
    const key = parseStrongKey(term, serie);
    if (key) {
      selectCode(key.code, key.serie);
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      setSearchResults(await searchStrongCodes(serie, term));
    } catch (err) {
      console.error('Error searching Strong codes:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => { setQuery(''); setSearchResults(null); };

  const listItems = searchResults ?? rangeItems;
  const onDefinitionClick = useStrongReferenceClick();
  const summaries = useMemo(
    () => new Map(listItems.map(item => [item.code, listSummary(item)])),
    [listItems]
  );

  const entryHtml = useMemo(() => (entry ? sanitizeStrongHtml(entry.content) : ''), [entry]);

  const translit = useMemo(
    () => (entry?.mot_translitere ? parseStrongTransliteration(entry.mot_translitere) : null),
    [entry]
  );
  const translations = useMemo(
    () => (entry?.traduction_generale ? parseStrongTranslations(entry.traduction_generale) : null),
    [entry]
  );
  // Code ouvert dans la fenêtre (renvoi cliqué dans l'origine)
  const [modalCode, setModalCode] = useState<StrongKey | null>(null);

  // Mots de la Segond 1910 qui portent ce code (« père », « pères »…), avec leur nombre d'occurrences
  const [wordForms, setWordForms] = useState<StrongWordForm[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setWordForms(null);
    getStrongWordForms(currentCode, serie)
      .then(forms => { if (!cancelled) setWordForms(forms); })
      .catch(err => { console.error('Error loading Strong word forms:', err); if (!cancelled) setWordForms([]); });
    return () => { cancelled = true; };
  }, [serie, currentCode]);
  const wordTotal = wordForms?.reduce((sum, f) => sum + f.count, 0) ?? 0;
  // Libellés de la version Louis Segond, lus dans bible_versions
  const [lsgVersion, setLsgVersion] = useState<LsgVersionInfo | null>(null);
  useEffect(() => {
    getLsgVersion().then(setLsgVersion).catch(() => setLsgVersion(null));
  }, []);
  const lsgLabel = lsgVersion?.code_display?.trim() || lsgVersion?.code || 'LSG';
  // Liste de versets ouverte : un mot, ou le code (tous les mots) ; réinitialisée à chaque changement de code
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  useEffect(() => { setSelectedWord(null); }, [serie, currentCode]);
  const CODE_SELECTION = '__code__';
  const selectedOccurrences = !wordForms || !selectedWord ? null
    : selectedWord === CODE_SELECTION ? wordForms.flatMap(f => f.occurrences)
      : wordForms.find(f => f.word === selectedWord)?.occurrences ?? null;
  const toggleWord = (word: string) => setSelectedWord(prev => (prev === word ? null : word));

  const hasSideSections = !loadingEntry && !!entry;

  // Codes voisins : les numéros jamais attribués par Strong (G2717, G3203-3302) sont sautés
  const prevCode = neighbourStrongCode(serie, currentCode, -1);
  const nextCode = neighbourStrongCode(serie, currentCode, 1);
  const neighbour = (code: number | null) => (code === null ? undefined : rangeItems.find(item => Number(item.code) === code));
  const prevEntry = neighbour(prevCode);
  const nextEntry = neighbour(nextCode);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Barre de contrôle */}
      <div className="sticky top-[40px] z-30 bg-[#B45309] dark:bg-[#292524] text-white">
        <div className="px-[10px] min-h-[30px] py-1 xl:py-0 flex flex-wrap items-center gap-2">
          {/* Afficher / masquer la liste des codes */}
          <button
            onClick={() => setShowList(v => !v)}
            aria-pressed={showList}
            title={showList ? 'Masquer la liste des codes' : 'Afficher la liste des codes'}
            className="h-[24px] w-[24px] rounded-md flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors"
          >
            {showList ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <h1 className="text-[15px] font-bold mr-2">Codes Strong</h1>

          {/* Série : hébreu (Ancien Testament) ou grec (Nouveau Testament) */}
          <div className="flex items-center h-[24px] rounded-md bg-white/15 p-0.5" role="group" aria-label="Série de codes">
            {(['H', 'G'] as StrongSerie[]).map(s => (
              <button
                key={s}
                onClick={() => selectSerie(s)}
                aria-pressed={serie === s}
                title={`Codes ${STRONG_SERIES[s].language}s (${STRONG_SERIES[s].testament})`}
                className={`h-full px-2 rounded text-[12px] font-semibold transition-colors ${
                  serie === s ? 'bg-white text-[#78350F]' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                {STRONG_SERIES[s].label} <span className={serie === s ? 'text-[#B45309]' : 'text-white/60'}>({s === 'H' ? 'AT' : 'NT'})</span>
              </button>
            ))}
          </div>

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
                <option key={i} value={i}>{rangeLabel(serie, i)}</option>
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
              placeholder={serie === 'H' ? 'Numéro (430), mot (père) ou translittération (elohiym)' : 'Numéro (25), mot (aimer) ou translittération (agapao)'}
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

      <main className={`px-[10px] py-[10px] grid gap-[18px] ${showList ? 'lg:grid-cols-[minmax(22rem,1fr)_2.4fr]' : ''}`}>
        {/* Liste (masquable) */}
        <section className={`${showList ? 'flex' : 'hidden'} lg:sticky lg:top-[80px] lg:h-[calc(100vh-90px)] flex-col rounded-xl border border-border bg-card overflow-hidden`}>
          <div className="px-3 py-1.5 border-b border-border text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>
              {searchResults
                ? `${searchResults.length}${searchResults.length === 200 ? '+' : ''} résultat${searchResults.length > 1 ? 's' : ''} pour « ${query.trim()} »`
                : `Codes ${rangeLabel(serie, rangeIndex)}`}
            </span>
            {loadingRange && !searchResults && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          </div>
          {/* Tableau : Code Strong · Mot translitéré · Mot original · Traduit par */}
          <div className="flex-1 overflow-y-auto thin-scrollbar max-h-[40vh] lg:max-h-none">
            <div className={`sticky top-0 z-10 ${LIST_COLUMNS} gap-2 pl-3 pr-2 py-1 bg-muted/80 backdrop-blur border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground`}>
              <span>Code</span>
              <span>Translitéré</span>
              <span className="text-right">Original</span>
              <span>Traduit par</span>
            </div>
            <ul>
              {listItems.map(item => {
                const code = Number(item.code);
                const active = code === currentCode;
                const translit = item.mot_translitere ? trimApostrophes(parseStrongTransliteration(item.mot_translitere).word) : '';
                return (
                  <li key={item.code} id={`strong-item-${code}`}>
                    <button
                      onClick={() => selectCode(code)}
                      className={`w-full text-left pl-3 pr-2 py-1.5 ${LIST_COLUMNS} gap-2 items-center border-b border-border/50 border-l-[3px] transition-colors ${
                        active
                          ? 'bg-amber-50 dark:bg-amber-900/30 border-l-amber-600'
                          : 'border-l-transparent hover:bg-muted/60'
                      }`}
                    >
                      <span className={`font-bold text-[13px] ${active ? 'text-amber-800 dark:text-amber-300' : 'text-amber-700 dark:text-amber-400'}`}>
                        {serie}{code}
                      </span>
                      <span className="min-w-0 truncate font-cambria italic text-[13px]" title={translit}>{translit || '—'}</span>
                      <span className="text-right truncate">
                        {item.mot_original
                          ? <StrongOriginalWord serie={item.serie} text={item.mot_original} className={`${item.serie === 'H' ? 'text-[18px]' : 'text-[15px]'} leading-none text-blue-700 dark:text-blue-300`} />
                          : <span className="text-[13px] text-muted-foreground">—</span>}
                      </span>
                      <span className="min-w-0 truncate text-[13px]" title={summaries.get(item.code)}>{summaries.get(item.code)}</span>
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
          </div>
        </section>

        {/* Fiche du code */}
        <div className="flex flex-col gap-[18px] min-w-0 min-h-[calc(100vh-90px)]">
          {/* En-tête : mot hébreu */}
          {/* Carte du code : mot hébreu à gauche ; Origine puis Traductions à droite */}
          <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C] text-white shadow-xl shadow-amber-900/20">
            {/* Filigrane */}
            {entry?.mot_original && (
              <span aria-hidden className="pointer-events-none select-none absolute -left-6 -bottom-16">
                <StrongOriginalWord serie={entry.serie} text={entry.mot_original} className="text-[10rem] leading-none text-white/[0.06]" />
              </span>
            )}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

            <div className="relative px-4 sm:px-5 py-2.5">
              {loadingEntry ? (
                <div className="min-h-[8rem] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-200" />
                </div>
              ) : (
                <div className={`grid gap-x-5 gap-y-3 ${hasSideSections ? 'xl:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]' : ''}`}>
                  {/* Mot hébreu */}
                  <div className="flex flex-col items-center justify-center text-center">
                    {entry?.mot_original ? (
                      <p>
                        <StrongOriginalWord
                          serie={entry.serie}
                          text={entry.mot_original}
                          className={`${entry.serie === 'H' ? 'text-[40px] sm:text-[48px]' : 'text-[34px] sm:text-[40px]'} leading-[1.05] text-amber-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]`}
                        />
                      </p>
                    ) : (
                      <p className="font-cambria text-[36px] leading-tight text-amber-50/90">{currentLabel}</p>
                    )}
                    {translit && (
                      <p className="font-cambria italic text-[18px] leading-tight text-white">{translit.word}</p>
                    )}
                    {translit?.pronunciation && (
                      <p className="text-[12px] leading-tight tracking-[0.15em] text-amber-200">/ {translit.pronunciation} /</p>
                    )}

                    {/* Occurrences et traductions comptées dans la Segond 1910 (mêmes chiffres que « Nombre d'emplois ») */}
                    <div className="mt-2 pt-1.5 border-t border-amber-200/25 flex items-stretch justify-center gap-6 sm:gap-8">
                      <div>
                        <div className="font-cambria text-[18px] font-bold leading-none text-amber-100">
                          {wordForms === null ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : formatCount(wordTotal)}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                          occurrence{wordTotal > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div>
                        <div className="font-cambria text-[18px] font-bold leading-none text-amber-100">
                          {wordForms === null ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : formatCount(wordForms.length)}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                          traduction{(wordForms?.length ?? 0) > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fiche du mot, à droite dans la carte : tableau */}
                  {hasSideSections && entry && (
                    <div className="min-w-0 pt-3 xl:pt-0 xl:pl-6 border-t xl:border-t-0 xl:border-l border-amber-200/25 flex items-center">
                      <table className="w-full font-cambria text-[14px] leading-tight rounded-xl overflow-hidden ring-1 ring-amber-200/30 bg-black/10 backdrop-blur-sm">
                        <tbody>
                          {([
                            ['Code Strong', <span className="font-bold text-amber-100">{currentLabel}</span>],
                            [`Mot ${STRONG_SERIES[serie].language}`, entry.mot_original
                              ? <StrongOriginalWord serie={entry.serie} text={entry.mot_original} className="text-[20px] leading-none text-amber-50" />
                              : null],
                            ['Translittération', entry.mot_translitere
                              ? <>{translit?.word}{translit?.pronunciation && <span className="text-amber-200/80"> ({translit.pronunciation})</span>}</>
                              : null],
                            ['Origine', entry.origine_mot
                              ? <StrongOriginText raw={entry.origine_mot} serie={entry.serie} onCodeClick={setModalCode} />
                              : null],
                            ['Type', entry.type_mot || null],
                          ] as [string, React.ReactNode][]).map(([label, value], i) => (
                            <tr key={label} className={i > 0 ? 'border-t border-amber-200/20' : ''}>
                              <th scope="row" className="w-[9rem] px-3 py-1 text-left align-middle text-[10px] font-bold uppercase tracking-[0.15em] text-amber-200/90 bg-amber-200/[0.06]">
                                {label}
                              </th>
                              <td className="px-3 py-1 align-middle text-amber-50">
                                {value ?? <span className="text-amber-200/50">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  onClick={onDefinitionClick}
                  dangerouslySetInnerHTML={{ __html: entryHtml }}
                />
              </section>

              {/* Mots de la Segond 1910 portant ce code, avec leur nombre d'occurrences ; clic = versets */}
              <section className="rounded-xl border border-border bg-card px-5 sm:px-8 py-5">
                <SectionTitle icon={<Languages className="w-4 h-4" />}>
                  Nombre d’emplois des mots associés dans la version {lsgVersion?.name ?? lsgLabel}
                </SectionTitle>
                <div className="flex flex-wrap items-center gap-2 font-cambria">
                  {wordForms === null ? (
                    <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
                    </span>
                  ) : wordForms.length === 0 ? (
                    <span className="italic text-[14px] text-muted-foreground">
                      Aucun mot relié à ce code dans les livres déjà importés.
                    </span>
                  ) : (
                    <>
                      {/* Code suivi de la somme des occurrences ; clic = tous les versets du code */}
                      <button
                        onClick={() => toggleWord(CODE_SELECTION)}
                        aria-pressed={selectedWord === CODE_SELECTION}
                        title={`Voir tous les versets où apparaît ${currentLabel}`}
                        className={`flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-lg bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C] shadow-md shadow-amber-900/20 text-amber-50 text-[14px] transition-all hover:brightness-110 ${
                          selectedWord === CODE_SELECTION ? 'ring-2 ring-amber-400' : 'ring-1 ring-amber-300/40'
                        }`}
                      >
                        <Search className="w-3.5 h-3.5 text-amber-200" />
                        <strong>{currentLabel}</strong>
                        <span className="text-amber-200/90">({lsgLabel})</span>
                        <span className="ml-0.5 min-w-[2rem] text-center px-1.5 rounded bg-amber-100 text-amber-900 text-[12px] font-bold tabular-nums">
                          {wordTotal.toLocaleString('fr-FR')}
                        </span>
                      </button>
                      <span className="text-muted-foreground">:</span>
                      {/* Chaque mot, précédé de son nombre d'occurrences ; clic = ses versets */}
                      {wordForms.map(form => {
                        const active = selectedWord === form.word;
                        return (
                          <button
                            key={form.word}
                            onClick={() => toggleWord(form.word)}
                            aria-pressed={active}
                            title={active ? 'Masquer les versets' : `Voir les versets où « ${form.word} » porte ${currentLabel}`}
                            className={`flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-lg border text-[14px] transition-colors ${
                              active
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                                : 'border-border bg-background hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-950/20'
                            }`}
                          >
                            <strong>{form.word}</strong>
                            <span className="min-w-[2rem] text-center px-1.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-[12px] font-bold tabular-nums">
                              {form.count.toLocaleString('fr-FR')}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Versets (80 %) et livres avec leurs occurrences (20 %) */}
                {selectedWord && selectedOccurrences && (
                  <StrongTermVerses
                    key={selectedWord}
                    title={selectedWord === CODE_SELECTION ? currentLabel : `« ${selectedWord} »`}
                    words={selectedWord === CODE_SELECTION ? wordForms!.map(f => f.word) : [selectedWord]}
                    occurrences={selectedOccurrences}
                    versionLabel={lsgLabel}
                    transliteration={translit?.word}
                    onClose={() => setSelectedWord(null)}
                  />
                )}
              </section>
            </>
          )}

          {!loadingEntry && !entry && !error && (
            <p className="text-sm text-muted-foreground px-1">Aucune définition pour ce code.</p>
          )}

          {/* Codes voisins : toujours visibles, fixés en bas de l'écran */}
          <nav className="mt-auto sticky bottom-0 z-20 -mx-[10px] px-[10px] py-2 grid grid-cols-2 gap-[18px] bg-background/90 backdrop-blur border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            {prevCode !== null ? (
              <button
                onClick={() => selectCode(prevCode)}
                title="Code précédent"
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-amber-400 hover:shadow-md transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-amber-700 group-hover:-translate-x-0.5 transition-transform" />
                <span className="min-w-0">
                  <span className="block text-[11px] leading-none font-bold text-amber-700 dark:text-amber-400">{serie}{prevCode}</span>
                  {/* Mot original puis mot translittéré */}
                  {prevEntry && (
                    <span className="flex items-baseline gap-2 min-w-0 mt-0.5">
                      {prevEntry.mot_original && (
                        <StrongOriginalWord serie={prevEntry.serie} text={firstWord(prevEntry.mot_original)} className="shrink-0 text-[20px] font-bold leading-none text-blue-700 dark:text-blue-300" />
                      )}
                      {prevEntry.mot_translitere && (
                        <span className="min-w-0 truncate font-cambria text-[16px] font-bold leading-none uppercase tracking-wide text-foreground/85">
                          {firstWord(trimApostrophes(parseStrongTransliteration(prevEntry.mot_translitere).word))}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>
            ) : <span />}
            {nextCode !== null && (
              <button
                onClick={() => selectCode(nextCode)}
                title="Code suivant"
                className="group flex items-center justify-end gap-3 rounded-xl border border-border bg-card px-4 py-3 text-right hover:border-amber-400 hover:shadow-md transition-all"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] leading-none font-bold text-amber-700 dark:text-amber-400">{serie}{nextCode}</span>
                  {/* Mot translittéré puis mot original */}
                  {nextEntry && (
                    <span className="flex items-baseline gap-2 min-w-0 mt-0.5 justify-end">
                      {nextEntry.mot_translitere && (
                        <span className="min-w-0 truncate font-cambria text-[16px] font-bold leading-none uppercase tracking-wide text-foreground/85">
                          {firstWord(trimApostrophes(parseStrongTransliteration(nextEntry.mot_translitere).word))}
                        </span>
                      )}
                      {nextEntry.mot_original && (
                        <StrongOriginalWord serie={nextEntry.serie} text={firstWord(nextEntry.mot_original)} className="shrink-0 text-[20px] font-bold leading-none text-blue-700 dark:text-blue-300" />
                      )}
                    </span>
                  )}
                </span>
                <ChevronRight className="w-5 h-5 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </nav>
        </div>
      </main>

      <StrongCodeModal
        code={modalCode}
        onClose={() => setModalCode(null)}
        onOpenPage={key => { setModalCode(null); selectCode(key.code, key.serie); }}
        versionLabel={lsgLabel}
      />
    </div>
  );
};

export default StrongCodesPage;
