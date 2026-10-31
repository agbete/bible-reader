import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Layers, Library } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DbBookItem } from '@/services/bibleDb';

interface NamedGroup {
  id: number;
  name: string;
  testament_id?: number;
}

interface Props {
  books: DbBookItem[];
  testaments: NamedGroup[];
  classifications: NamedGroup[];
  selected: Set<number>;
  onChange: (selected: Set<number>) => void;
}

/** Case à cocher à trois états : cochée, décochée, partielle */
export const TriCheckbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}> = ({ checked, indeterminate = false, onChange, className = '' }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className={`w-4 h-4 shrink-0 cursor-pointer accent-amber-600 ${className}`}
    />
  );
};

/** Portée de la recherche : livres organisés par testament puis par classement, avec cases à cocher */
export const BookScopePicker: React.FC<Props> = ({ books, testaments, classifications, selected, onChange }) => {
  const tree = useMemo(() => {
    const sorted = [...books].sort((a, b) => a.order_index - b.order_index);
    return testaments.map(testament => {
      const testamentBooks = sorted.filter(b => b.testament_id === testament.id);
      const groups = classifications
        .filter(c => testamentBooks.some(b => b.classification_id === c.id))
        .map(c => ({ classification: c, books: testamentBooks.filter(b => b.classification_id === c.id) }));
      return { testament, books: testamentBooks, groups };
    }).filter(t => t.books.length > 0);
  }, [books, testaments, classifications]);

  const allIds = useMemo(() => books.map(b => b.id), [books]);
  const allSelected = selected.size === allIds.length;

  const stateOf = (ids: number[]) => {
    const count = ids.filter(id => selected.has(id)).length;
    return { checked: count === ids.length && ids.length > 0, indeterminate: count > 0 && count < ids.length };
  };

  const setMany = (ids: number[], checked: boolean) => {
    const next = new Set(selected);
    ids.forEach(id => (checked ? next.add(id) : next.delete(id)));
    onChange(next);
  };

  // Résumé affiché sur le bouton
  const summary = (() => {
    if (allSelected) return 'Toute la Bible';
    if (selected.size === 0) return 'Aucun livre';
    const fullTestament = tree.find(t => t.books.length === selected.size && t.books.every(b => selected.has(b.id)));
    if (fullTestament) return fullTestament.testament.name;
    for (const t of tree) {
      const group = t.groups.find(g => g.books.length === selected.size && g.books.every(b => selected.has(b.id)));
      if (group) return group.classification.name;
    }
    if (selected.size === 1) return books.find(b => selected.has(b.id))?.name ?? '1 livre';
    return `${selected.size} livres`;
  })();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-6 pl-2 pr-1.5 rounded-md border border-white/30 bg-white/10 hover:bg-white/20 text-[12px] font-semibold flex items-center gap-1.5 max-w-[16rem] transition-colors"
          title="Livres où chercher"
        >
          <Library className="w-3.5 h-3.5 shrink-0" />
          <span className="text-white/75 font-normal">Dans</span>
          <span className="truncate">{summary}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" portal={false} className="font-cambria w-[min(40rem,94vw)] p-0 rounded-2xl shadow-2xl overflow-hidden">
        {/* Raccourcis */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer">
            <TriCheckbox
              checked={allSelected}
              indeterminate={!allSelected && selected.size > 0}
              onChange={checked => onChange(new Set(checked ? allIds : []))}
            />
            Toute la Bible
          </label>
          <span className="ml-auto text-[12px] text-muted-foreground">
            {selected.size} / {allIds.length} livres
          </span>
          {selected.size > 0 && !allSelected && (
            <button onClick={() => onChange(new Set())} className="text-[12px] text-amber-700 dark:text-amber-400 hover:underline">
              Tout décocher
            </button>
          )}
        </div>

        {/* Testaments → classements → livres (même présentation que le sélecteur de livre de la page) */}
        <div className="max-h-[58vh] overflow-y-auto overscroll-contain thin-scrollbar p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tree.map(({ testament, books: testamentBooks, groups }) => {
              const tState = stateOf(testamentBooks.map(b => b.id));
              return (
                <div key={testament.id} className="min-w-0">
                  <label className="sticky top-0 z-10 mb-2 px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-500/30 rounded-md cursor-pointer">
                    <TriCheckbox {...tState} onChange={checked => setMany(testamentBooks.map(b => b.id), checked)} className="w-3.5 h-3.5" />
                    <span className="truncate">{testament.name}</span>
                    <span className="ml-auto font-semibold normal-case tracking-normal text-amber-700/70 dark:text-amber-300/70">
                      {testamentBooks.filter(b => selected.has(b.id)).length}/{testamentBooks.length}
                    </span>
                  </label>
                  <div className="space-y-2 ml-3">
                    {groups.map(({ classification, books: groupBooks }) => {
                      const cState = stateOf(groupBooks.map(b => b.id));
                      return (
                        <div key={classification.id}>
                          <label className="flex items-center gap-1.5 px-2 py-1 text-sm font-bold uppercase text-blue-700 dark:text-blue-300 cursor-pointer">
                            <TriCheckbox {...cState} onChange={checked => setMany(groupBooks.map(b => b.id), checked)} className="w-3.5 h-3.5" />
                            <Layers className="w-3.5 h-3.5" />
                            <span className="truncate">{classification.name}</span>
                          </label>
                          <div className="space-y-0.5 ml-5 pl-2 border-l border-blue-200 dark:border-blue-900">
                            {groupBooks.map(book => (
                              <label
                                key={book.id}
                                className={`flex items-center gap-2 px-2 py-1 text-sm rounded-md hover:bg-muted/50 transition-colors cursor-pointer ${
                                  selected.has(book.id) ? 'bg-amber-500/10' : ''
                                }`}
                              >
                                <TriCheckbox checked={selected.has(book.id)} onChange={checked => setMany([book.id], checked)} className="w-3.5 h-3.5" />
                                <span className="font-bold text-black dark:text-white truncate">{book.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
