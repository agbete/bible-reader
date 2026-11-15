import React, { useEffect, useRef, useState } from 'react';
import { Columns3, Loader2, Plus, X } from 'lucide-react';
import { BookSearchSelect } from '@/components/bible/BookSearchSelect';
import { ChapterNavigator } from '@/components/bible/ChapterNavigator';
import { TITLE_LEVEL_STYLES } from '@/components/bible/titleStyles';
import {
  getDbChapterVerses, getDbVerseTitles, versionDisplayCode,
  DbBibleVersion, DbBookItem, DbLanguage, DbVerseItem
} from '@/services/bibleDb';
import { getStrongLinksForChapter, strongSerieOfBook, StrongSerie, StrongWordLink, hasStrongLinks } from '@/services/strongDb';

// ─── Lecture multiple : plusieurs passages ouverts côte à côte, chacun dans sa colonne ───────
// Chaque colonne a son livre, son chapitre et sa version ; la disposition et l'endroit atteint
// dans chaque colonne sont gardés pour la prochaine ouverture.

export const MAX_READER_COLUMNS = 6;

interface ReaderColumnState {
  id: string;
  bookCode: string;
  chapter: number;
  versionCode: string;
}

const COLUMNS_KEY = 'reader-multi-columns';
const SCROLL_KEY = 'reader-multi-scroll';
const OPEN_KEY = 'reader-multi-open';

const newColumnId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readColumns(): ReaderColumnState[] {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) || 'null');
    if (!Array.isArray(saved)) return [];
    return saved
      .filter(c => c && typeof c.bookCode === 'string' && Number(c.chapter) > 0 && typeof c.versionCode === 'string')
      .slice(0, MAX_READER_COLUMNS)
      .map(c => ({ id: String(c.id || newColumnId()), bookCode: c.bookCode, chapter: Number(c.chapter), versionCode: c.versionCode }));
  } catch {
    return [];
  }
}

function readScrollPositions(): Record<string, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(SCROLL_KEY) || 'null');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

/** La fenêtre était ouverte (retour depuis la page d'un code Strong, rechargement) */
export function readMultiReaderOpen(): boolean {
  try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
}

/** Colonnes visibles à l'écran (au-delà : défilement horizontal) */
function visibleColumnsFor(width: number) {
  if (width >= 1800) return 6;
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 768) return 2;
  return 1;
}

interface MultiReaderModalProps {
  booksList: DbBookItem[];
  testamentsList: { id: number; code: string; name: string }[];
  classificationsList: { id: number; name: string; code?: string; testament_id: number }[];
  testamentNames: Map<number, string>;
  classificationNames: Map<number, string>;
  versions: DbBibleVersion[];
  languages: DbLanguage[];
  /** Passage affiché sur la page : contenu des colonnes à la première ouverture */
  initialBookCode: string | null;
  initialChapter: number;
  initialVersionCode: string;
  readerTextStyle: React.CSSProperties;
  showTitles: boolean;
  /** Codes Strong après les mots (Louis Segond), rendus comme sur la page */
  renderStrongText?: (text: string, words: StrongWordLink[], serie: StrongSerie) => React.ReactNode;
  onClose: () => void;
}

export const MultiReaderModal: React.FC<MultiReaderModalProps> = ({
  booksList, testamentsList, classificationsList, testamentNames, classificationNames,
  versions, languages, initialBookCode, initialChapter, initialVersionCode,
  readerTextStyle, showTitles, renderStrongText, onClose
}) => {
  const [columns, setColumns] = useState<ReaderColumnState[]>(() => {
    const saved = readColumns();
    if (saved.length > 0) return saved;
    const bookCode = initialBookCode ?? booksList[0]?.code ?? 'GEN';
    return [0, 1].map(() => ({ id: newColumnId(), bookCode, chapter: initialChapter || 1, versionCode: initialVersionCode }));
  });
  const scrollPositions = useRef<Record<string, number>>(readScrollPositions());
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns)); } catch { /* stockage indisponible */ }
  }, [columns]);

  useEffect(() => {
    try { sessionStorage.setItem(OPEN_KEY, '1'); } catch { /* stockage indisponible */ }
    // La page derrière la fenêtre ne défile plus
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const saveScroll = (id: string, top: number) => {
    scrollPositions.current[id] = top;
    try { localStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPositions.current)); } catch { /* stockage indisponible */ }
  };

  const handleClose = () => {
    try { sessionStorage.removeItem(OPEN_KEY); } catch { /* stockage indisponible */ }
    onClose();
  };

  const updateColumn = (id: string, patch: (column: ReaderColumnState) => Partial<ReaderColumnState>) => {
    setColumns(prev => prev.map(c => (c.id === id ? { ...c, ...patch(c) } : c)));
  };

  const addColumn = () => {
    if (columns.length >= MAX_READER_COLUMNS) return;
    const last = columns[columns.length - 1];
    const column = { ...last, id: newColumnId() };
    setColumns(prev => [...prev, column]);
    // La nouvelle colonne est amenée à l'écran
    requestAnimationFrame(() => {
      const container = columnsRef.current;
      container?.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
    });
  };

  const removeColumn = (id: string) => {
    if (columns.length <= 1) return;
    setColumns(prev => prev.filter(c => c.id !== id));
    delete scrollPositions.current[id];
    try { localStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPositions.current)); } catch { /* stockage indisponible */ }
  };

  const visible = Math.min(visibleColumnsFor(viewportWidth), columns.length);
  const columnWidth = `calc(100% / ${visible})`;

  return (
    <div className="fixed inset-0 z-[60] bg-background text-foreground flex flex-col" role="dialog" aria-modal="true" aria-label="Lecture multiple">
      {/* Barre de la fenêtre */}
      <div className="h-[30px] shrink-0 px-[10px] flex items-center gap-[10px] bg-gradient-to-r from-[#78350F] via-[#92400E] to-[#78350F] text-white">
        <Columns3 className="w-4 h-4 text-amber-300 shrink-0" />
        <span className="font-cambria font-bold text-[15px] leading-none truncate">Lecture multiple</span>
        <span className="text-[11px] text-amber-200/90 leading-none">{columns.length}/{MAX_READER_COLUMNS} colonnes</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={addColumn}
          disabled={columns.length >= MAX_READER_COLUMNS}
          className="h-[22px] px-2 rounded-full bg-white/15 hover:bg-white/25 text-[12px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          title={columns.length >= MAX_READER_COLUMNS ? `${MAX_READER_COLUMNS} colonnes au maximum` : 'Ajouter une colonne'}
        >
          <Plus className="w-3.5 h-3.5" /> Colonne
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="h-[22px] w-[22px] rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
          title="Fermer la lecture multiple"
          aria-label="Fermer la lecture multiple"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Colonnes : chacune défile seule ; au-delà des colonnes visibles, défilement horizontal */}
      <div ref={columnsRef} className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory thin-scrollbar">
        {columns.map((column, index) => (
          <ReaderColumn
            key={column.id}
            column={column}
            width={columnWidth}
            // Colonnes de la moitié droite de l'écran : les listes s'ouvrent vers la gauche
            dropdownAlign={index % visible >= visible / 2 && visible > 1 ? 'right' : 'left'}
            canRemove={columns.length > 1}
            booksList={booksList}
            testamentsList={testamentsList}
            classificationsList={classificationsList}
            testamentNames={testamentNames}
            classificationNames={classificationNames}
            versions={versions}
            languages={languages}
            readerTextStyle={readerTextStyle}
            showTitles={showTitles}
            renderStrongText={renderStrongText}
            initialScrollTop={scrollPositions.current[column.id] ?? 0}
            onScrollSave={top => saveScroll(column.id, top)}
            onChange={patch => updateColumn(column.id, patch)}
            onRemove={() => removeColumn(column.id)}
          />
        ))}
      </div>
    </div>
  );
};

interface ReaderColumnProps {
  column: ReaderColumnState;
  width: string;
  dropdownAlign: 'left' | 'right';
  canRemove: boolean;
  booksList: DbBookItem[];
  testamentsList: MultiReaderModalProps['testamentsList'];
  classificationsList: MultiReaderModalProps['classificationsList'];
  testamentNames: Map<number, string>;
  classificationNames: Map<number, string>;
  versions: DbBibleVersion[];
  languages: DbLanguage[];
  readerTextStyle: React.CSSProperties;
  showTitles: boolean;
  renderStrongText?: MultiReaderModalProps['renderStrongText'];
  initialScrollTop: number;
  onScrollSave: (top: number) => void;
  onChange: (patch: (column: ReaderColumnState) => Partial<ReaderColumnState>) => void;
  onRemove: () => void;
}

const ReaderColumn: React.FC<ReaderColumnProps> = ({
  column, width, dropdownAlign, canRemove, booksList, testamentsList, classificationsList,
  testamentNames, classificationNames, versions, languages, readerTextStyle, showTitles,
  renderStrongText, initialScrollTop, onScrollSave, onChange, onRemove
}) => {
  const book = booksList.find(b => b.code.toUpperCase() === column.bookCode.toUpperCase()) ?? null;
  const version = versions.find(v => v.code === column.versionCode);
  const languageId = version?.language_id;
  const [verses, setVerses] = useState<DbVerseItem[]>([]);
  const [titles, setTitles] = useState<Record<number, Record<string, string>>>({});
  const [strongWords, setStrongWords] = useState<Map<number, StrongWordLink[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** Défilement à rétablir une fois le chapitre affiché (ouverture : position gardée ; titre : son verset) */
  const pendingScroll = useRef<{ top: number } | { verseId: number; verse: number } | null>({ top: initialScrollTop });
  const scrollTimer = useRef<number | null>(null);

  const strongEnabled = Boolean(renderStrongText) && hasStrongLinks(column.versionCode);

  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const chapterVerses = await getDbChapterVerses(book.id, column.chapter, column.versionCode);
      if (cancelled) return;
      setVerses(chapterVerses);
      setLoading(false);
      const chapterTitles = await getDbVerseTitles(chapterVerses.map(v => v.id), languageId);
      if (!cancelled) setTitles(chapterTitles);
    })();
    return () => { cancelled = true; };
  }, [book?.id, column.chapter, column.versionCode, languageId]);

  useEffect(() => {
    if (!strongEnabled || !book) { setStrongWords(null); return; }
    let cancelled = false;
    getStrongLinksForChapter(book.code, column.chapter, column.versionCode)
      .then(byVerse => { if (!cancelled) setStrongWords(byVerse); })
      .catch(err => console.error('[MultiReader] Erreur codes Strong:', err));
    return () => { cancelled = true; };
  }, [strongEnabled, book?.code, column.chapter, column.versionCode]);

  // Défilement en attente, appliqué quand le texte (et ses titres) est affiché
  useEffect(() => {
    const body = bodyRef.current;
    const target = pendingScroll.current;
    if (!body || loading || verses.length === 0 || !target) return;
    if ('top' in target) {
      body.scrollTop = target.top;
    } else {
      const el = body.querySelector<HTMLElement>(`[data-title-verse-id="${target.verseId}"]`)
        ?? body.querySelector<HTMLElement>(`[data-verse-number="${target.verse}"]`);
      if (!el) return;
      body.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' });
    }
    pendingScroll.current = null;
  }, [loading, verses, titles]);

  const goTo = (patch: Partial<ReaderColumnState>, scroll: { top: number } | { verseId: number; verse: number } = { top: 0 }) => {
    pendingScroll.current = scroll;
    onChange(() => patch);
  };

  const handleChapterChange = (chapter: number) => {
    pendingScroll.current = { top: 0 };
    // Fonctionnel : après un changement de livre, le chapitre est borné par le nouveau livre
    onChange(current => {
      const currentBook = booksList.find(b => b.code === current.bookCode);
      return { chapter: Math.max(1, Math.min(chapter, currentBook?.chapters_count ?? chapter)) };
    });
  };

  const handleScroll = () => {
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      if (bodyRef.current) onScrollSave(bodyRef.current.scrollTop);
    }, 300);
  };

  const renderTitles = (verseId: number, afterVerse: boolean) => {
    if (!showTitles) return null;
    const entries = Object.entries(titles[verseId] ?? {})
      .filter(([, text]) => Boolean(text && String(text).trim()))
      .sort(([a], [b]) => Number(a) - Number(b));
    if (entries.length === 0) return null;
    return (
      <div data-title-verse-id={verseId} className={`w-full text-left ${afterVerse ? 'mt-[1em]' : 'mt-0.5'} mb-0.5 border-b border-amber-500/20 pb-0.5`}>
        {entries.map(([level, text]) => {
          const lvl = parseInt(level, 10);
          const style = TITLE_LEVEL_STYLES[lvl] ?? TITLE_LEVEL_STYLES[5];
          return (
            <div key={level} className={`font-cambria leading-tight ${style.className}`} style={{ fontSize: style.fontSize }}>
              {text}
            </div>
          );
        })}
      </div>
    );
  };

  // Versions groupées par langue, dans l'ordre des langues de la base
  const versionGroups = languages
    .map(language => ({ language, items: versions.filter(v => v.language_id === language.id) }))
    .filter(group => group.items.length > 0);

  return (
    <section
      className="h-full shrink-0 snap-start flex flex-col border-r border-border last:border-r-0 min-w-0"
      style={{ width }}
    >
      {/* En-tête : mêmes sélecteurs de livre et de chapitre que la page Lecture */}
      <div className="relative z-30 shrink-0 min-h-[30px] xl:h-[30px] px-[6px] py-1 xl:py-0 flex items-center gap-1 bg-[#B45309] dark:bg-[#292524]">
        <div className="flex-1 min-w-[6rem]">
          <BookSearchSelect
            booksList={booksList}
            selectedBook={book}
            selectedChapter={column.chapter}
            onSelectBook={(nextBook, chapter) => goTo({ bookCode: nextBook.code, chapter })}
            currentVersion={column.versionCode}
            testamentsList={testamentsList}
            classificationsList={classificationsList}
            testamentNames={testamentNames}
            classificationNames={classificationNames}
            dropdownAlign={dropdownAlign}
            compact
          />
        </div>
        <div className="min-w-0 shrink xl:flex xl:h-6 xl:items-center">
          <ChapterNavigator
            selectedBook={book}
            selectedChapter={column.chapter}
            booksList={booksList}
            onChapterChange={handleChapterChange}
            onBookChange={nextBook => goTo({ bookCode: nextBook.code, chapter: 1 })}
            titleLanguageId={languageId}
            onSelectTitle={(chapter, verse, verseId) => {
              if (chapter === column.chapter) {
                pendingScroll.current = { verseId, verse };
                // Même chapitre : rien ne se recharge, on défile tout de suite
                const body = bodyRef.current;
                const el = body?.querySelector<HTMLElement>(`[data-title-verse-id="${verseId}"]`)
                  ?? body?.querySelector<HTMLElement>(`[data-verse-number="${verse}"]`);
                if (body && el) {
                  body.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' });
                  pendingScroll.current = null;
                }
              } else {
                goTo({ chapter }, { verseId, verse });
              }
            }}
            showTitleNavigator={false}
            dropdownAlign={dropdownAlign}
            compact
          />
        </div>
        <select
          value={column.versionCode}
          onChange={e => goTo({ versionCode: e.target.value }, { top: bodyRef.current?.scrollTop ?? 0 })}
          className="h-9 xl:h-6 max-w-[4.75rem] shrink-0 rounded-md bg-white/10 hover:bg-white/20 px-1 text-[12px] font-bold text-white outline-none cursor-pointer [&_option]:text-foreground [&_option]:bg-background [&_optgroup]:text-foreground [&_optgroup]:bg-background"
          title={version?.name ?? column.versionCode}
          aria-label="Version"
        >
          {versionGroups.map(({ language, items }) => (
            <optgroup key={language.id} label={language.name}>
              {items.map(v => <option key={v.code} value={v.code}>{versionDisplayCode(v)} — {v.name}</option>)}
            </optgroup>
          ))}
          {!version && <option value={column.versionCode}>{column.versionCode}</option>}
        </select>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="h-6 w-5 shrink-0 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title={canRemove ? 'Fermer cette colonne' : 'Au moins une colonne doit rester ouverte'}
          aria-label="Fermer cette colonne"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Texte du chapitre */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-[10px] pt-[11px] pb-6 thin-scrollbar"
      >
        {!book ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Choisissez un livre</div>
        ) : loading ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
            <span className="text-xs font-medium">Chargement des versets...</span>
          </div>
        ) : verses.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Aucun verset trouvé pour ce chapitre dans cette version.</div>
        ) : (
          <div
            // Hébreu (WLC) : de droite à gauche, police hébraïque
            {...(column.versionCode?.toUpperCase() === 'WLC' ? { dir: 'rtl' as const, lang: 'he' } : {})}
            className={`space-y-0.5 font-serif leading-snug ${column.versionCode?.toUpperCase() === 'WLC' ? 'font-hebrew text-right' : ''}`}
            style={column.versionCode?.toUpperCase() === 'WLC' ? { ...readerTextStyle, fontFamily: undefined } : readerTextStyle}
          >
            {verses.map((verse, verseIndex) => {
              const words = strongWords?.get(verse.verse_number);
              return (
                <div key={verse.id} data-verse-number={verse.verse_number}>
                  {renderTitles(verse.id, verseIndex > 0)}
                  <div className="flex items-start gap-[3px] px-1.5 py-0.5 rounded-xl hover:bg-amber-500/10 dark:hover:bg-amber-500/15 transition-colors">
                    <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 select-none pt-px shrink-0 min-w-[0.75rem]">
                      {verse.verse_number}
                    </span>
                    <p className="text-foreground flex-1">
                      {verse.is_missing
                        ? <span className="text-muted-foreground/60">—</span>
                        : words?.length && renderStrongText ? renderStrongText(verse.text, words, strongSerieOfBook(book.code)) : verse.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
