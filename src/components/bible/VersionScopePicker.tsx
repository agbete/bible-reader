import React, { useMemo } from 'react';
import { BookCopy, ChevronDown } from 'lucide-react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DbBibleVersion, DbLanguage } from '@/services/bibleDb';
import { versionDisplayCode } from '@/services/bibleDb';
import { TriCheckbox } from '@/components/bible/BookScopePicker';

interface Props {
  versions: DbBibleVersion[];
  languages: DbLanguage[];
  /** Codes des versions cochées */
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Versions affichées sur la page (raccourci) */
  pageVersionCodes?: string[];
  /** Élément dont le panneau prend la largeur (en-tête de la fenêtre de recherche) */
  anchorRef?: React.RefObject<HTMLElement>;
}

/** Ordre d'affichage des langues (codes de la table languages) ; les autres suivent par nom */
const LANGUAGE_ORDER = ['fr', 'en', 'fn', 'gu', 'yo', 'hb', 'gr'];
const languageRank = (code?: string) => {
  const index = LANGUAGE_ORDER.indexOf((code ?? '').toLowerCase());
  return index === -1 ? LANGUAGE_ORDER.length : index;
};

/** Versions où chercher : groupées par langue, avec cases à cocher */
export const VersionScopePicker: React.FC<Props> = ({ versions, languages, selected, onChange, pageVersionCodes = [], anchorRef }) => {
  const groups = useMemo(() => {
    const byLanguage = new Map<number, DbBibleVersion[]>();
    versions.forEach(v => {
      const list = byLanguage.get(v.language_id) ?? [];
      list.push(v);
      byLanguage.set(v.language_id, list);
    });
    return Array.from(byLanguage.entries())
      .map(([languageId, list]) => ({
        languageId,
        code: languages.find(l => l.id === languageId)?.code,
        name: languages.find(l => l.id === languageId)?.name ?? `Langue ${languageId}`,
        versions: list.sort((a, b) => versionDisplayCode(a).localeCompare(versionDisplayCode(b))),
      }))
      .sort((a, b) => languageRank(a.code) - languageRank(b.code) || a.name.localeCompare(b.name, 'fr'));
  }, [versions, languages]);

  const selectedSet = new Set(selected);
  // Ordre stable : celui de la liste des versions
  const setMany = (codes: string[], checked: boolean) => {
    const next = new Set(selected);
    codes.forEach(code => (checked ? next.add(code) : next.delete(code)));
    onChange(versions.map(v => v.code).filter(code => next.has(code)));
  };

  const summary = (() => {
    if (selected.length === 0) return 'Aucune version';
    const labels = selected.map(code => versionDisplayCode(versions.find(v => v.code === code), code));
    return labels.length <= 3 ? labels.join(', ') : `${labels.length} versions`;
  })();

  const pageCodes = pageVersionCodes.filter(code => versions.some(v => v.code === code));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-6 pl-2 pr-1.5 rounded-md border border-white/30 bg-white/10 hover:bg-white/20 text-[12px] font-semibold flex items-center gap-1.5 max-w-[16rem] transition-colors"
          title="Versions où chercher"
        >
          <BookCopy className="w-3.5 h-3.5 shrink-0" />
          <span className="text-white/75 font-normal">Versions</span>
          <span className="truncate">{summary}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-80" />
        </button>
      </PopoverTrigger>
      {/* Ancré sur l'en-tête : le panneau occupe toute la largeur de la fenêtre, centré */}
      {anchorRef && <PopoverPrimitive.Anchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />}
      <PopoverContent
        align="center"
        sideOffset={0}
        portal={false}
        className={`font-cambria p-0 shadow-2xl overflow-hidden ${
          anchorRef ? 'w-[var(--radix-popper-anchor-width)] rounded-none rounded-b-2xl border-x-0' : 'w-auto max-w-[94vw] rounded-2xl'
        }`}
      >
        {/* Raccourcis */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 border-b border-border text-[12px]">
          <span className="font-bold text-[13px]">{selected.length} version{selected.length > 1 ? 's' : ''} cochée{selected.length > 1 ? 's' : ''}</span>
          <span className="ml-auto flex items-center gap-3">
            {pageCodes.length > 0 && (
              <button onClick={() => onChange(pageCodes)} className="text-amber-700 dark:text-amber-400 hover:underline">
                Versions de la page
              </button>
            )}
            <button onClick={() => onChange(['LSG'])} className="text-amber-700 dark:text-amber-400 hover:underline">
              LSG seule
            </button>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="text-amber-700 dark:text-amber-400 hover:underline">
                Tout décocher
              </button>
            )}
          </span>
        </div>

        {/* Langues → versions */}
        {/* Une colonne par langue */}
        <div className="p-2 grid gap-x-2 gap-y-1.5 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 items-start">
          {groups.map(group => {
            const codes = group.versions.map(v => v.code);
            const count = codes.filter(code => selectedSet.has(code)).length;
            return (
              <div key={group.languageId} className="min-w-0">
                <label className="mb-0.5 px-2 py-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-500/30 rounded-md cursor-pointer">
                  <TriCheckbox
                    checked={count === codes.length}
                    indeterminate={count > 0 && count < codes.length}
                    onChange={checked => setMany(codes, checked)}
                    className="w-3.5 h-3.5"
                  />
                  <span className="truncate">{group.name}</span>
                  <span className="ml-auto font-semibold normal-case tracking-normal text-amber-700/70 dark:text-amber-300/70">
                    {count}/{codes.length}
                  </span>
                </label>
                <div className="ml-2">
                  {group.versions.map(v => (
                    <label
                      key={v.code}
                      className={`flex items-center gap-1.5 px-1 py-px text-[11px] leading-tight whitespace-nowrap rounded hover:bg-muted/50 transition-colors cursor-pointer ${
                        selectedSet.has(v.code) ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <TriCheckbox checked={selectedSet.has(v.code)} onChange={checked => setMany([v.code], checked)} className="w-3 h-3" />
                      <span className="min-w-0 truncate" title={`${versionDisplayCode(v)} — ${v.name}`}>{v.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
