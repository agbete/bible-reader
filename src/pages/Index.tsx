import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookMarked, BookOpen, BookText, Check, Copy, Feather, Globe2, Hash, History,
  Landmark, Languages, Library, Loader2, Search, Sparkles, Volume2, VolumeX,
} from 'lucide-react';
import { Navbar } from '@/components/bible/Navbar';
import { getDbBookNameEntries, versionDisplayCode } from '@/services/bibleDb';
import {
  dailyStrongCode, DailyVerse, getDailyVerse, getHomeLibrary, getHomeStats, HomeLibrary, HomeStats,
  LastReading, readLastReading,
} from '@/services/homeDb';
import {
  getStrongCode, getStrongWordForms, parseStrongTranslations, parseStrongTransliteration, StrongCode, StrongWordForm,
} from '@/services/strongDb';
import { buildBookNameIndex, BookNameIndex, parseReferences } from '@/utils/bibleReference';

const formatCount = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('fr-FR'));

/** Ordre d'affichage des langues (comme dans le choix des versions de la recherche) */
const LANGUAGE_ORDER = ['fr', 'en', 'fn', 'gu', 'yo', 'hb', 'gr'];
const languageRank = (code?: string) => {
  const index = LANGUAGE_ORDER.indexOf((code ?? '').toLowerCase());
  return index === -1 ? LANGUAGE_ORDER.length : index;
};

/** Dégradé or des cartes de prestige (même que la carte du code Strong) */
const GOLD_GRADIENT = 'bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C]';

/** Titre de section : sur-titre doré, titre Cambria et filet */
const SectionHeading: React.FC<{ eyebrow: string; title: string; aside?: React.ReactNode }> = ({ eyebrow, title, aside }) => (
  <div className="flex items-end gap-4 mb-[18px]">
    <div className="min-w-0">
      <p className="text-[11px] leading-none font-bold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-400">{eyebrow}</p>
      <h2 className="mt-1.5 font-cambria text-[26px] sm:text-[30px] leading-tight font-bold text-stone-900 dark:text-amber-50">{title}</h2>
    </div>
    <span className="flex-1 mb-2 h-px bg-gradient-to-r from-amber-400/70 via-amber-300/30 to-transparent" />
    {aside}
  </div>
);

/** Ornement : losange entre deux filets dorés */
const Ornament: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden className={`flex items-center gap-2 ${className}`}>
    <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-300/70" />
    <span className="w-1.5 h-1.5 rotate-45 bg-amber-300" />
    <span className="h-px w-10 bg-gradient-to-l from-transparent to-amber-300/70" />
  </div>
);

const Index: React.FC = () => {
  const navigate = useNavigate();
  const [library, setLibrary] = useState<HomeLibrary | null>(null);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null | undefined>(undefined);
  const [bookNameIndex, setBookNameIndex] = useState<BookNameIndex | null>(null);
  const [lastReading] = useState<LastReading | null>(() => readLastReading());

  useEffect(() => {
    let cancelled = false;
    getHomeLibrary()
      .then(lib => {
        if (cancelled) return;
        setLibrary(lib);
        getHomeStats(lib.dictionaries).then(s => { if (!cancelled) setStats(s); });
      })
      .catch(err => console.error('[Index] Erreur bibliothèque:', err));
    getDailyVerse()
      .then(v => { if (!cancelled) setDailyVerse(v); })
      .catch(() => { if (!cancelled) setDailyVerse(null); });
    getDbBookNameEntries().then(entries => { if (!cancelled) setBookNameIndex(buildBookNameIndex(entries)); });
    return () => { cancelled = true; };
  }, []);

  const bookByCode = useMemo(() => new Map((library?.books ?? []).map(b => [b.code, b])), [library]);
  const languageCount = useMemo(
    () => new Set((library?.versions ?? []).map(v => v.language_id)).size,
    [library]
  );

  // ─── Recherche : une référence ouvre le passage, un mot ouvre la recherche avancée ───
  const [query, setQuery] = useState('');
  const submitSearch = (value = query) => {
    const text = value.trim();
    if (!text) return;
    const reference = bookNameIndex ? parseReferences(text, bookNameIndex).find(r => r.start === 0) : undefined;
    navigate(reference ? `/bible?ref=${reference.referenceCode}` : `/bible?q=${encodeURIComponent(text)}`);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F1] dark:bg-stone-950 text-foreground flex flex-col selection:bg-amber-500/25">
      <Navbar />

      {/* ─── Héros : titre, recherche, verset du jour ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C0F05] via-[#451A03] to-[#78350F] dark:from-[#0C0A09] dark:via-[#1C1917] dark:to-[#292524] text-amber-50">
        <span aria-hidden className="pointer-events-none absolute -top-40 -right-32 w-[34rem] h-[34rem] rounded-full bg-amber-500/20 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 w-[30rem] h-[30rem] rounded-full bg-yellow-600/10 blur-3xl" />
        <span
          aria-hidden
          dir="rtl"
          className="pointer-events-none select-none absolute -bottom-10 left-1/2 -translate-x-1/2 font-hebrew text-[9rem] sm:text-[13rem] leading-none text-white/[0.04] whitespace-nowrap"
        >
          דְּבַר אֱלֹהִים
        </span>

        <div className="relative max-w-7xl mx-auto px-[10px] sm:px-6 pt-10 sm:pt-14 pb-20 grid gap-[18px] lg:gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] leading-none font-bold uppercase tracking-[0.3em] text-amber-300">
              <Sparkles className="w-3.5 h-3.5" /> Parole Vivante · Bible d’étude
            </p>
            <h1 className="mt-3 font-cambria text-[40px] sm:text-[56px] leading-[1.02] font-bold">
              La Parole,
              <br />
              <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">lue de près.</span>
            </h1>
            <p className="mt-3 max-w-xl font-cambria text-[17px] leading-snug text-amber-100/85">
              {library
                ? <>Lisez {formatCount(library.versions.length)} versions en {formatCount(languageCount)} langues côte à côte, cherchez dans toute la Bible et remontez à l’hébreu grâce à {formatCount(stats?.strongCodes)} codes Strong.</>
                : <>Lisez plusieurs versions côte à côte, cherchez dans toute la Bible et remontez à l’hébreu grâce aux codes Strong.</>}
            </p>

            {/* Recherche universelle */}
            <form
              onSubmit={e => { e.preventDefault(); submitSearch(); }}
              className="mt-[18px] max-w-xl flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.08] ring-1 ring-amber-200/25 backdrop-blur focus-within:ring-amber-300/70 transition-shadow"
            >
              <Search className="ml-2 w-5 h-5 shrink-0 text-amber-300" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Jean 3:16, Psaume 23, lumière…"
                className="flex-1 min-w-0 bg-transparent py-2 font-cambria text-[17px] text-amber-50 placeholder:text-amber-100/40 outline-none"
              />
              <button
                type="submit"
                className="shrink-0 h-10 px-4 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-stone-950 text-[13px] font-bold shadow-lg shadow-black/20 hover:from-amber-200 hover:to-amber-400 transition-colors"
              >
                Rechercher
              </button>
            </form>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] leading-none">
              <span className="text-amber-100/50">Essayez :</span>
              {['Jean 3:16', 'Psaume 23', 'Romains 8:28', 'lumière'].map(example => (
                <button
                  key={example}
                  onClick={() => submitSearch(example)}
                  className="px-2 py-1 rounded-full ring-1 ring-amber-200/20 text-amber-100/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="mt-[18px] flex flex-wrap items-center gap-2">
              <Link
                to="/bible"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-amber-50 text-[#451A03] text-[13px] font-bold shadow-lg shadow-black/20 hover:bg-white transition-colors"
              >
                <BookOpen className="w-4 h-4" /> Ouvrir la Bible
              </Link>
              {lastReading && (
                <Link
                  to={`/bible?ref=${lastReading.referenceCode}`}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl ring-1 ring-amber-200/30 text-amber-50 text-[13px] font-bold hover:bg-white/10 transition-colors"
                >
                  <History className="w-4 h-4 text-amber-300" /> Reprendre : {lastReading.bookName} {lastReading.chapter}
                </Link>
              )}
            </div>
          </div>

          <DailyVerseCard verse={dailyVerse} bookName={dailyVerse ? bookByCode.get(dailyVerse.bookCode)?.name : undefined} />
        </div>
      </section>

      <main className="relative flex-1 w-full max-w-7xl mx-auto px-[10px] sm:px-6 pb-14">
        {/* ─── Chiffres de la base ─── */}
        <section className="-mt-10 relative z-10 rounded-2xl bg-card ring-1 ring-amber-200/60 dark:ring-amber-900/50 shadow-xl shadow-amber-900/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 divide-x divide-y lg:divide-y-0 divide-amber-200/50 dark:divide-amber-900/40 overflow-hidden">
          {([
            ['Versions', library?.versions.length, Library],
            ['Langues', library ? languageCount : undefined, Globe2],
            ['Livres', stats?.books, BookMarked],
            ['Chapitres', stats?.chapters, BookOpen],
            ['Versets', stats?.verses, Feather],
            ['Codes Strong', stats?.strongCodes, Hash],
            ['Articles', stats?.dictionaryEntries, BookText],
          ] as [string, number | null | undefined, React.ComponentType<{ className?: string }>][]).map(([label, value, Icon]) => (
            <div key={label} className="px-3 py-3 text-center">
              <Icon className="mx-auto w-4 h-4 text-amber-600 dark:text-amber-400" />
              <div className="mt-1 font-cambria text-[24px] leading-none font-bold tabular-nums text-[#78350F] dark:text-amber-200">
                {value === undefined ? <Loader2 className="mx-auto w-5 h-5 animate-spin text-amber-500" /> : formatCount(value)}
              </div>
              <div className="mt-1 text-[10px] leading-none font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
            </div>
          ))}
        </section>

        {/* ─── Outils d'étude ─── */}
        <section className="mt-12">
          <SectionHeading eyebrow="Étudier" title="Quatre outils, une seule Parole" />
          <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            <ToolCard
              to="/bible"
              icon={<BookOpen className="w-5 h-5" />}
              title="Lecture"
              text={`Jusqu’à plusieurs versions en colonnes alignées, dans ${formatCount(languageCount || null)} langues.`}
              points={['Trésors et références croisées', 'Codes Strong sous chaque mot', 'Aperçu des passages cités']}
              cta="Lire la Bible"
            />
            <ToolCard
              to="/bible?q="
              icon={<Search className="w-5 h-5" />}
              title="Recherche avancée"
              text={`Dans les ${formatCount(stats?.verses)} versets, une ou plusieurs versions à la fois.`}
              points={['Mot entier, début ou fin de mot', 'Par testament, classement ou livre', 'Résultats par livre et par verset']}
              cta="Chercher"
            />
            <ToolCard
              to="/dictionnaire"
              icon={<BookText className="w-5 h-5" />}
              title="Dictionnaires"
              text={`${formatCount(library?.dictionaries.length)} dictionnaire${(library?.dictionaries.length ?? 0) > 1 ? 's' : ''} bibliques, ${formatCount(stats?.dictionaryEntries)} articles.`}
              points={['Index alphabétique', 'Renvois entre articles', 'Mise en page soignée']}
              cta="Consulter"
            />
            <ToolCard
              to="/code-strong"
              icon={<Hash className="w-5 h-5" />}
              title="Code Strong"
              text={`${formatCount(stats?.strongCodes)} mots hébreux, avec leurs emplois dans la Segond 1910.`}
              points={['Définition et origine du mot', 'Mots traduits, comptés', 'Versets liés à la lecture']}
              cta="Explorer"
            />
          </div>
        </section>

        {/* ─── Code Strong du jour · Dictionnaires ─── */}
        <section className="mt-12 grid gap-[18px] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <DailyStrongCard />
          <div className="rounded-2xl bg-card ring-1 ring-border p-[18px] flex flex-col">
            <p className="text-[11px] leading-none font-bold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-400">Consulter</p>
            <h3 className="mt-1.5 font-cambria text-[22px] leading-tight font-bold">Les dictionnaires</h3>
            <ul className="mt-3 flex-1 divide-y divide-border">
              {library === null ? (
                <li className="py-3 flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</li>
              ) : library.dictionaries.length === 0 ? (
                <li className="py-3 text-[13px] italic text-muted-foreground">Aucun dictionnaire disponible.</li>
              ) : library.dictionaries.map(d => (
                <li key={d.id}>
                  <Link to="/dictionnaire" className="group flex items-center gap-3 py-2">
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-cambria text-[15px] font-bold">
                      {d.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-cambria text-[16px] leading-tight font-bold group-hover:text-amber-800 dark:group-hover:text-amber-300">{d.name}</span>
                    <ArrowRight className="w-4 h-4 text-amber-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── Bibliothèque : testaments → classements → livres ─── */}
        <section className="mt-12">
          <SectionHeading
            eyebrow="Bibliothèque"
            title="Les livres de la Bible"
            aside={stats?.books ? <span className="mb-1 text-[12px] font-bold tabular-nums text-muted-foreground">{formatCount(stats.books)} livres</span> : undefined}
          />
          {library === null ? (
            <div className="py-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement des livres…</div>
          ) : (
            <div className="grid gap-[18px] lg:grid-cols-2">
              {library.testaments.map(testament => {
                const classifications = library.classifications.filter(c => c.testament_id === testament.id);
                const testamentBooks = library.books.filter(b => b.testament_id === testament.id);
                return (
                  <article key={testament.id} className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
                    <header className={`${GOLD_GRADIENT} px-[18px] py-[10px] flex items-baseline gap-3 text-amber-50`}>
                      <Landmark className="w-4 h-4 self-center text-amber-300" />
                      <h3 className="font-cambria text-[20px] leading-none font-bold">{testament.name}</h3>
                      <span className="ml-auto text-[12px] font-bold tabular-nums text-amber-200/90">{testamentBooks.length} livres</span>
                    </header>
                    <div className="px-[18px] py-[10px] flex flex-col gap-[10px]">
                      {classifications.map(classification => {
                        const books = testamentBooks.filter(b => b.classification_id === classification.id);
                        if (books.length === 0) return null;
                        return (
                          <div key={classification.id}>
                            <h4 className="text-[12px] leading-none font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">{classification.name}</h4>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {books.map(book => (
                                <Link
                                  key={book.id}
                                  to={`/bible?ref=${book.code}.1.1`}
                                  title={`${book.name} · ${book.chapters_count} chapitre${book.chapters_count > 1 ? 's' : ''}`}
                                  className="group inline-flex items-baseline gap-1 px-2 py-1 rounded-md border border-border bg-background font-cambria text-[14px] leading-none hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                >
                                  <span className="font-bold group-hover:text-amber-800 dark:group-hover:text-amber-300">{book.name}</span>
                                  <span className="text-[10px] tabular-nums text-muted-foreground">{book.chapters_count}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Versions par langue ─── */}
        <section className="mt-12">
          <SectionHeading eyebrow="Traductions" title="Versions disponibles" />
          {library === null ? (
            <div className="py-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement des versions…</div>
          ) : (
            <div className="grid gap-[18px] grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {[...library.languages]
                .filter(language => library.versions.some(v => v.language_id === language.id))
                .sort((a, b) => languageRank(a.code) - languageRank(b.code) || a.name.localeCompare(b.name, 'fr'))
                .map(language => {
                  const versions = library.versions.filter(v => v.language_id === language.id);
                  return (
                    <div key={language.id} className="rounded-xl bg-card ring-1 ring-border p-[10px]">
                      <h3 className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-amber-200/60 dark:border-amber-900/50 text-[12px] leading-none font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-300">
                        <Languages className="w-3.5 h-3.5" /> {language.name}
                        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{versions.length}</span>
                      </h3>
                      <ul className="flex flex-col gap-1">
                        {versions.map(version => (
                          <li key={version.id} className="flex items-baseline gap-1.5 min-w-0 text-[12px] leading-tight">
                            <span className="shrink-0 px-1 rounded bg-amber-100 dark:bg-amber-950/60 text-[10px] font-bold text-amber-800 dark:text-amber-300">{versionDisplayCode(version)}</span>
                            <span className="min-w-0 truncate" title={version.name}>{version.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </main>

      <footer className={`${GOLD_GRADIENT} text-amber-50`}>
        <div className="max-w-7xl mx-auto px-[10px] sm:px-6 py-8 flex flex-col items-center text-center gap-2">
          <Ornament />
          <p className="font-cambria text-[18px] leading-snug italic text-amber-100 max-w-2xl">
            « Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. »
          </p>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">Psaume 119:105</p>
          <p className="mt-2 flex items-center gap-2 text-[12px] text-amber-200/70">
            <BookOpen className="w-3.5 h-3.5" /> Parole Vivante — Bible d’étude
          </p>
        </div>
      </footer>
    </div>
  );
};

/** Verset du jour (Louis Segond) : copie, écoute, lien vers le chapitre */
const DailyVerseCard: React.FC<{ verse: DailyVerse | null | undefined; bookName?: string }> = ({ verse, bookName }) => {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  const reference = verse ? `${bookName ?? verse.bookCode} ${verse.chapter}:${verse.verse}` : '';
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const copy = () => {
    if (!verse) return;
    navigator.clipboard?.writeText(`« ${verse.text} » — ${reference} (LSG)`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  const speak = () => {
    if (!verse || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(`${reference}. ${verse.text}`);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <aside className="relative rounded-3xl p-[18px] sm:p-6 bg-white/[0.06] ring-1 ring-amber-200/25 backdrop-blur-md shadow-2xl shadow-black/30">
      <span aria-hidden className="pointer-events-none absolute inset-2 rounded-[1.25rem] ring-1 ring-amber-200/10" />
      <div className="relative flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 ring-1 ring-amber-300/30 text-[11px] leading-none font-bold uppercase tracking-[0.15em] text-amber-200">
          <Sparkles className="w-3 h-3" /> Verset du jour
        </span>
        <span className="ml-auto text-[12px] leading-none first-letter:uppercase text-amber-100/60">{today}</span>
      </div>

      {verse === undefined ? (
        <div className="relative py-14 flex items-center justify-center gap-2 text-[13px] text-amber-100/70">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : verse === null ? (
        <p className="relative py-14 text-center font-cambria italic text-amber-100/70">Verset indisponible pour le moment.</p>
      ) : (
        <>
          <span aria-hidden className="relative block mt-3 -mb-6 font-cambria text-[72px] leading-none text-amber-300/40">“</span>
          <blockquote className="relative font-cambria text-[21px] sm:text-[24px] leading-snug text-amber-50">
            {verse.text}
          </blockquote>
          <div className="relative mt-3 flex items-center gap-3">
            <Ornament />
            <span className="font-cambria text-[16px] font-bold text-amber-300">{reference}</span>
          </div>
          <div className="relative mt-[18px] pt-3 border-t border-amber-200/15 flex items-center gap-1.5">
            <Link
              to={`/bible?ref=${verse.referenceCode}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-stone-950 text-[12px] font-bold hover:from-amber-200 hover:to-amber-400 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" /> Lire le chapitre <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button onClick={speak} className={`ml-auto w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${speaking ? 'bg-amber-400 text-stone-950' : 'text-amber-100/80 hover:bg-white/10'}`} title={speaking ? 'Arrêter la lecture' : 'Écouter le verset'}>
              {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={copy} className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-100/80 hover:bg-white/10 transition-colors" title="Copier le verset">
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

/** Carte d'un outil : médaillon doré, description, points forts et lien */
const ToolCard: React.FC<{
  to: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  points: string[];
  cta: string;
  onClick?: () => void;
}> = ({ to, icon, title, text, points, cta, onClick }) => (
  <Link
    to={to}
    onClick={onClick ? e => { e.preventDefault(); onClick(); } : undefined}
    className="group relative flex flex-col rounded-2xl bg-card ring-1 ring-border p-[18px] hover:ring-amber-400 hover:shadow-xl hover:shadow-amber-900/10 hover:-translate-y-0.5 transition-all"
  >
    <span className={`w-11 h-11 rounded-xl ${GOLD_GRADIENT} text-amber-100 flex items-center justify-center shadow-md shadow-amber-900/20 ring-1 ring-amber-300/40`}>
      {icon}
    </span>
    <h3 className="mt-3 font-cambria text-[21px] leading-tight font-bold">{title}</h3>
    <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{text}</p>
    <ul className="mt-2 flex-1 flex flex-col gap-1">
      {points.map(point => (
        <li key={point} className="flex items-start gap-2 text-[13px] leading-tight">
          <span className="mt-[5px] w-1.5 h-1.5 shrink-0 rotate-45 bg-amber-500" /> {point}
        </li>
      ))}
    </ul>
    <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-amber-800 dark:text-amber-300">
      {cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </span>
  </Link>
);

/** Code Strong du jour : mot hébreu, translittération et mots qui le traduisent */
const DailyStrongCard: React.FC = () => {
  const code = useMemo(() => dailyStrongCode(), []);
  const [entry, setEntry] = useState<StrongCode | null | undefined>(undefined);
  const [forms, setForms] = useState<StrongWordForm[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getStrongCode('H', code).then(e => { if (!cancelled) setEntry(e); }).catch(() => { if (!cancelled) setEntry(null); });
    getStrongWordForms(code).then(f => { if (!cancelled) setForms(f); }).catch(() => { if (!cancelled) setForms([]); });
    return () => { cancelled = true; };
  }, [code]);

  const translit = entry?.mot_translitere ? parseStrongTransliteration(entry.mot_translitere) : null;
  // Mots de la Segond 1910 portant ce code ; à défaut, les traductions de la fiche
  const words: { word: string; count: number | null }[] = forms && forms.length > 0
    ? forms.slice(0, 8).map(f => ({ word: f.word, count: f.count }))
    : entry?.traduction_generale
      ? parseStrongTranslations(entry.traduction_generale).terms.slice(0, 8).map(t => ({ word: t.term, count: t.count }))
      : [];

  return (
    <article className={`relative overflow-hidden rounded-2xl ${GOLD_GRADIENT} text-amber-50 shadow-xl shadow-amber-900/20`}>
      {entry?.mot_original && (
        <span aria-hidden dir="rtl" className="pointer-events-none select-none absolute -left-4 -bottom-14 font-hebrew text-[9rem] leading-none text-white/[0.06]">
          {entry.mot_original}
        </span>
      )}
      <div className="relative p-[18px] grid gap-[18px] sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center">
        <div className="text-center">
          <p className="text-[11px] leading-none font-bold uppercase tracking-[0.25em] text-amber-300">Code Strong du jour</p>
          {entry === undefined ? (
            <Loader2 className="mx-auto my-10 w-6 h-6 animate-spin text-amber-300" />
          ) : (
            <>
              <div dir="rtl" lang="he" className="mt-3 font-hebrew text-[56px] leading-none text-amber-50 drop-shadow">
                {entry?.mot_original || '—'}
              </div>
              {translit && <p className="mt-2 font-cambria text-[18px] leading-none italic text-amber-100">{translit.word}</p>}
              {translit?.pronunciation && <p className="mt-1 text-[12px] leading-none tracking-[0.15em] text-amber-200/80">/ {translit.pronunciation} /</p>}
              <p className="mt-2 inline-block px-2 py-0.5 rounded-full bg-white/15 text-[12px] font-bold">H{code}</p>
            </>
          )}
        </div>
        <div className="min-w-0">
          {entry?.type_mot && <p className="text-[11px] leading-none font-bold uppercase tracking-[0.15em] text-amber-200/90">{entry.type_mot}</p>}
          <h3 className="mt-1.5 font-cambria text-[22px] leading-tight font-bold">Traduit par</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {forms === null && entry !== null ? (
              <span className="flex items-center gap-2 text-[13px] text-amber-100/70"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</span>
            ) : words.length === 0 ? (
              <span className="text-[13px] italic text-amber-100/70">Aucune traduction enregistrée.</span>
            ) : words.map(w => (
              <span key={w.word} className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-lg bg-black/15 ring-1 ring-amber-200/25 font-cambria text-[14px]">
                <strong>{w.word}</strong>
                {w.count !== null && (
                  <span className="min-w-[1.6rem] text-center px-1 rounded bg-amber-100 text-amber-900 text-[11px] font-bold tabular-nums">{formatCount(w.count)}</span>
                )}
              </span>
            ))}
          </div>
          <Link
            to={`/code-strong?code=H${code}`}
            className="mt-[18px] inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-amber-50 text-[#451A03] text-[12px] font-bold hover:bg-white transition-colors"
          >
            Voir la fiche complète <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default Index;
