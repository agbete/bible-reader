import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Languages, Loader2, ScrollText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  getStrongCode,
  getStrongWordForms,
  parseStrongOrigin,
  parseStrongTransliteration,
  resolveStrongReference,
  sanitizeStrongHtml,
  StrongCode,
  StrongSerie,
  StrongWordForm,
} from '@/services/strongDb';
import { showError } from '@/utils/toast';

const formatCount = (n: number) => n.toLocaleString('fr-FR');

/** Code d'une série : { serie: 'G', code: 25 } = G25 */
export interface StrongKey {
  serie: StrongSerie;
  code: number;
}

export const strongLabel = (key: StrongKey) => `${key.serie}${key.code}`;

/** Mot original : hébreu de droite à gauche, grec de gauche à droite (police adaptée à chaque alphabet) */
export const StrongOriginalWord: React.FC<{ serie: StrongSerie; text: string; className?: string }> = ({ serie, text, className = '' }) => (
  serie === 'H'
    ? <span dir="rtl" lang="he" className={`font-hebrew ${className}`}>{text}</span>
    : <span lang="el" className={`font-cambria ${className}`}>{text}</span>
);

/** Définitions : un clic sur un renvoi (« Job 31.12 ») ouvre le verset sur la page Lecture */
export function useStrongReferenceClick() {
  const navigate = useNavigate();
  return async (event: React.MouseEvent) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a.strong-ref');
    if (!link) return;
    event.preventDefault();
    const reference = link.dataset.ref ?? '';
    const code = await resolveStrongReference(reference);
    if (code) navigate(`/bible?ref=${code}`);
    else showError(`Référence introuvable : ${reference}`);
  };
}

/** Texte de l'origine, chaque renvoi vers un code en exposant cliquable (sans agrandir l'interligne) */
export const StrongOriginText: React.FC<{ raw: string; serie: StrongSerie; onCodeClick: (key: StrongKey) => void; tone?: 'light' | 'dark' }> = ({ raw, serie, onCodeClick, tone = 'dark' }) => {
  const parts = useMemo(() => parseStrongOrigin(raw, serie), [raw, serie]);
  return (
    <>
      {parts.map((part, i) => typeof part === 'string'
        ? <span key={i}>{part}</span>
        : (
          <sup key={i} className="leading-[0] text-[0.72em]">
            <button
              type="button"
              onClick={() => onCodeClick(part)}
              className={`ml-px px-0.5 rounded font-bold underline decoration-dotted underline-offset-2 transition-colors ${
                tone === 'dark'
                  ? 'text-amber-200 hover:text-white hover:bg-white/15'
                  : 'text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40'
              }`}
              title={`Voir le code ${strongLabel(part)}`}
            >
              {/* Renvoi vers l'autre série : sa lettre est affichée (H175 dans une fiche grecque) */}
              {part.serie !== serie ? strongLabel(part) : part.code}
            </button>
          </sup>
        ))}
    </>
  );
};

const ModalSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-amber-700 dark:text-amber-400">{icon}</span>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-300">{title}</h3>
      <span className="flex-1 h-px bg-gradient-to-r from-amber-300/70 dark:from-amber-700/60 to-transparent" />
    </div>
    {children}
  </section>
);

interface Props {
  /** Code ouvert ; null = fenêtre fermée */
  code: StrongKey | null;
  onClose: () => void;
  /** Ouvre la fiche complète du code sur la page Code Strong */
  onOpenPage: (key: StrongKey) => void;
  /** Code affiché de la version Louis Segond (ex. LSG) */
  versionLabel: string;
}

/** Fenêtre d'un code Strong : traductions (Segond 1910) et définition ; les renvois de l'origine s'y enchaînent */
export const StrongCodeModal: React.FC<Props> = ({ code, onClose, onOpenPage, versionLabel }) => {
  // Codes parcourus dans la fenêtre (renvois de l'origine), le dernier est affiché
  const [trail, setTrail] = useState<StrongKey[]>([]);
  useEffect(() => { setTrail(code === null ? [] : [code]); }, [code]);
  const current = trail[trail.length - 1] ?? null;

  const [entry, setEntry] = useState<StrongCode | null | undefined>(undefined);
  const [wordForms, setWordForms] = useState<StrongWordForm[] | null>(null);
  useEffect(() => {
    if (current === null) return;
    let cancelled = false;
    setEntry(undefined);
    setWordForms(null);
    getStrongCode(current.serie, current.code)
      .then(found => { if (!cancelled) setEntry(found); })
      .catch(err => { console.error('Error loading Strong code:', err); if (!cancelled) setEntry(null); });
    getStrongWordForms(current.code, current.serie)
      .then(forms => { if (!cancelled) setWordForms(forms); })
      .catch(err => { console.error('Error loading Strong word forms:', err); if (!cancelled) setWordForms([]); });
    return () => { cancelled = true; };
  }, [current?.serie, current?.code]);

  const onDefinitionClick = useStrongReferenceClick();
  const translit = entry?.mot_translitere ? parseStrongTransliteration(entry.mot_translitere) : null;
  const html = useMemo(() => (entry ? sanitizeStrongHtml(entry.content) : ''), [entry]);
  const total = wordForms?.reduce((sum, f) => sum + f.count, 0) ?? 0;

  return (
    <Dialog open={code !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="font-cambria max-w-2xl w-[94vw] max-h-[85vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col [&>button]:hidden">
        {/* En-tête doré : code, mot hébreu, translittération */}
        <header className="relative shrink-0 px-[18px] py-[10px] bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C] text-white">
          <div className="flex items-center gap-2">
            {trail.length > 1 && (
              <button
                onClick={() => setTrail(prev => prev.slice(0, -1))}
                className="p-1 rounded hover:bg-white/15"
                title={`Revenir à ${strongLabel(trail[trail.length - 2])}`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <DialogTitle className="text-[15px] font-bold leading-none text-amber-100">{current && strongLabel(current)}</DialogTitle>
            {entry?.type_mot && <span className="text-[11px] leading-none text-amber-200/80">{entry.type_mot}</span>}
            <button
              onClick={() => current !== null && onOpenPage(current)}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[12px] leading-none text-amber-100 hover:bg-white/15"
              title="Ouvrir la fiche complète"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Fiche
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/15" title="Fermer">
              <X className="w-4 h-4" />
            </button>
          </div>
          {entry && (
            <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
              {entry.mot_original && (
                <StrongOriginalWord serie={entry.serie} text={entry.mot_original} className="text-[30px] leading-none text-amber-50" />
              )}
              {translit && (
                <span className="text-[15px] leading-none italic text-amber-100">
                  {translit.word}
                  {translit.pronunciation && <span className="not-italic text-amber-200/80"> / {translit.pronunciation} /</span>}
                </span>
              )}
            </div>
          )}
          {entry?.origine_mot && (
            <p className="mt-1.5 text-[13px] leading-snug text-amber-50">
              <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-200/90">Origine</span>
              <StrongOriginText raw={entry.origine_mot} serie={entry.serie} onCodeClick={next => setTrail(prev => [...prev, next])} />
            </p>
          )}
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain thin-scrollbar px-[18px] py-[10px] flex flex-col gap-[18px]">
          {entry === undefined ? (
            <div className="py-6 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> Chargement…
            </div>
          ) : entry === null ? (
            <p className="py-6 text-center text-[14px] italic text-muted-foreground">Aucune fiche pour {current && strongLabel(current)}.</p>
          ) : (
            <>
              {/* Mots de la Segond 1910 portant ce code, avec leur nombre d'occurrences */}
              <ModalSection icon={<Languages className="w-4 h-4" />} title={`Traductions dans la version ${versionLabel}`}>
                {wordForms === null ? (
                  <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
                  </span>
                ) : wordForms.length === 0 ? (
                  <span className="italic text-[14px] text-muted-foreground">Aucun mot relié à ce code dans les livres déjà importés.</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-lg bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C] text-amber-50 text-[13px]">
                      <strong>{current && strongLabel(current)}</strong>
                      <span className="min-w-[1.75rem] text-center px-1 rounded bg-amber-100 text-amber-900 text-[11px] font-bold tabular-nums">{formatCount(total)}</span>
                    </span>
                    <span className="text-muted-foreground">:</span>
                    {wordForms.map(form => (
                      <span key={form.word} className="flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-lg border border-border bg-background text-[13px]">
                        <strong>{form.word}</strong>
                        <span className="min-w-[1.75rem] text-center px-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-[11px] font-bold tabular-nums">
                          {formatCount(form.count)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </ModalSection>

              <ModalSection icon={<ScrollText className="w-4 h-4" />} title="Définition">
                {html
                  ? <div className="strong-content text-[15px] leading-snug" onClick={onDefinitionClick} dangerouslySetInnerHTML={{ __html: html }} />
                  : <span className="italic text-[14px] text-muted-foreground">Aucune définition.</span>}
              </ModalSection>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
