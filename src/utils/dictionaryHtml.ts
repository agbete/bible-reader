/**
 * Contenu des dictionnaires : HTML importé d'un site, avec des onclick
 *   quick_pick_d('W','Diane')            → renvoi vers une autre entrée
 *   quick_pick('Tite', '3', '12', '0')   → référence biblique
 * On le nettoie (balises de mise en forme seulement, aucun attribut d'origine) et on
 * remplace ces onclick par des attributs data-* exploitables par la page.
 */

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'EM', 'I', 'STRONG', 'B', 'SUP', 'SUB', 'SPAN', 'A',
  'H2', 'H3', 'H4', 'BLOCKQUOTE', 'OL', 'UL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
]);

/** Noms des entrées citées en renvoi */
export function extractDictionaryRefs(raw: string): string[] {
  return Array.from(raw.matchAll(/quick_pick_d\('[^']*',\s*'([^']+)'\)/g), m => m[1]);
}

/**
 * @param resolved noms des entrées existantes : seuls ces renvois deviennent des liens
 */
export function sanitizeDictionaryHtml(raw: string, resolved?: Map<string, number>): string {
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;

  const clean = (node: Element) => {
    Array.from(node.children).forEach(child => {
      clean(child);
      const onclick = child.getAttribute('onclick') || '';
      const dictRef = onclick.match(/quick_pick_d\('[^']*',\s*'([^']+)'\)/);
      const bibleRef = onclick.match(/quick_pick(?:_apoc)?\('([^']+)',\s*'(\d+)',\s*'(\d+)'(?:,\s*'(\d+)')?/);

      if (dictRef) {
        const id = resolved?.get(dictRef[1]);
        const el = doc.createElement(id ? 'a' : 'span');
        el.append(...Array.from(child.childNodes));
        el.setAttribute('data-dict-ref', dictRef[1]);
        if (id) el.setAttribute('data-entry-id', String(id));
        child.replaceWith(el);
      } else if (bibleRef) {
        const [, book, chapter, verse, toVerse] = bibleRef;
        const el = doc.createElement('span');
        el.append(...Array.from(child.childNodes));
        el.setAttribute('data-bible-ref', [book, chapter, verse, toVerse && toVerse !== '0' ? toVerse : ''].join('|'));
        child.replaceWith(el);
      } else if (!ALLOWED_TAGS.has(child.tagName) || child.tagName === 'A') {
        // div, footer, liens vers le site d'origine… : on garde le texte
        child.replaceWith(...Array.from(child.childNodes));
      } else {
        const keep: Record<string, string | null> = {
          type: child.tagName === 'OL' ? child.getAttribute('type') : null,
          start: child.tagName === 'OL' ? child.getAttribute('start') : null,
          colspan: /^T[DH]$/.test(child.tagName) ? child.getAttribute('colspan') : null,
          rowspan: /^T[DH]$/.test(child.tagName) ? child.getAttribute('rowspan') : null,
        };
        Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
        Object.entries(keep).forEach(([name, value]) => {
          if (value && /^[\w]+$/.test(value)) child.setAttribute(name, value);
        });
      }
    });
  };
  clean(root);
  return root.innerHTML.trim();
}

/** Extrait en texte brut pour les listes */
export function dictionaryExcerpt(raw: string, max = 180): string {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** « Voir Diane. » : l'entrée n'est qu'un renvoi */
export function isCrossReferenceOnly(raw: string): boolean {
  return /^voir\s/i.test(dictionaryExcerpt(raw, 400)) && dictionaryExcerpt(raw, 400).length < 80;
}
