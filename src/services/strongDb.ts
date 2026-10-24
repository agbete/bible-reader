import { supabase } from '@/integrations/supabase/client';

export interface StrongCode {
  code: string;
  content: string;
  mot_hebreu_original?: string | null;
  origine_mot?: string | null;
  mot_hebreu_translitere?: string | null;
  type_mot?: string | null;
  traduction_generale?: string | null;
}

const STRONG_COLUMNS = 'code, content, mot_hebreu_original, origine_mot, mot_hebreu_translitere, type_mot, traduction_generale';

/** Codes Strong hébreux : numérotés de 1 à 8674 */
export const STRONG_MAX_CODE = 8674;

const cache = new Map<string, StrongCode>();

/**
 * Codes d'une plage numérique (ex. 1 → 100). La colonne `code` est du texte :
 * on interroge la liste exacte des numéros puis on trie numériquement.
 */
export async function getStrongCodesRange(from: number, to: number): Promise<StrongCode[]> {
  const codes: string[] = [];
  for (let n = from; n <= to; n++) codes.push(String(n));

  const missing = codes.filter(c => !cache.has(c));
  for (let i = 0; i < missing.length; i += 200) {
    const chunk = missing.slice(i, i + 200);
    const { data, error } = await supabase
      .from('strong_codes')
      .select(STRONG_COLUMNS)
      .in('code', chunk);
    if (error) throw error;
    (data || []).forEach((row: StrongCode) => cache.set(row.code.trim(), row));
  }

  return codes.map(c => cache.get(c)).filter((row): row is StrongCode => !!row);
}

export async function getStrongCode(code: string): Promise<StrongCode | null> {
  const key = code.trim();
  if (cache.has(key)) return cache.get(key)!;
  const { data, error } = await supabase
    .from('strong_codes')
    .select(STRONG_COLUMNS)
    .eq('code', key)
    .maybeSingle();
  if (error) throw error;
  if (data) cache.set(key, data as StrongCode);
  return (data as StrongCode) || null;
}

/** Recherche dans les définitions, traductions, translittérations et mots hébreux (200 résultats max, triés par numéro) */
export async function searchStrongCodes(query: string): Promise<StrongCode[]> {
  const term = query.trim().replace(/[%_,()]/g, ' ');
  if (!term) return [];
  const { data, error } = await supabase
    .from('strong_codes')
    .select(STRONG_COLUMNS)
    .or(['content', 'traduction_generale', 'mot_hebreu_translitere', 'mot_hebreu_original']
      .map(col => `${col}.ilike.%${term}%`).join(','))
    .limit(200);
  if (error) throw error;
  const rows = (data || []) as StrongCode[];
  rows.forEach(row => cache.set(row.code.trim(), row));
  return rows.sort((a, b) => Number(a.code) - Number(b.code));
}

const ALLOWED_TAGS = new Set(['P', 'OL', 'UL', 'LI', 'SUP', 'SUB', 'B', 'STRONG', 'I', 'EM', 'BR', 'SPAN']);

/**
 * Nettoie le HTML importé : retire les guillemets d'encadrement, les <tr>/<td>,
 * les attributs (onclick…) et les liens externes ; ne garde que les balises de mise en forme.
 */
export function sanitizeStrongHtml(raw: string): string {
  const html = raw
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/<\/?(tr|td|table|tbody)[^>]*>/gi, '');
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;

  const clean = (node: Element) => {
    Array.from(node.children).forEach(child => {
      clean(child);
      if (child.tagName === 'A' || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') {
        // Liens « Définition » vers un site externe : supprimés
        child.remove();
      } else if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
      } else {
        const listType = child.tagName === 'OL' ? child.getAttribute('type') : null;
        Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
        if (listType && /^[1aAiI]$/.test(listType)) child.setAttribute('type', listType);
      }
    });
  };
  clean(root);
  return root.innerHTML.trim();
}

/** Texte brut court (première définition) pour la liste */
export function strongSummary(raw: string, max = 90): string {
  const div = document.createElement('div');
  div.innerHTML = sanitizeStrongHtml(raw);
  const first = div.querySelector('li')?.firstChild?.textContent || div.textContent || '';
  const text = first.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface StrongTranslation {
  term: string;
  count: number | null;
}

/**
 * « Dieu 2425, dieux 159, Éternel 5, divinement ; 2599 » → termes (avec occurrences) + total.
 * Sans « ; », un nombre isolé en fin de liste est pris comme total.
 */
export function parseStrongTranslations(raw: string): { terms: StrongTranslation[]; total: number | null } {
  let body = raw.trim();
  let total: number | null = null;
  const semi = body.lastIndexOf(';');
  if (semi !== -1 && /^\s*\d+\s*$/.test(body.slice(semi + 1))) {
    total = parseInt(body.slice(semi + 1), 10);
    body = body.slice(0, semi);
  }
  // « paternelle 1061 (1215) » ou « gens,... 526: 551 » : le dernier nombre est le total
  const tail = total === null ? body.match(/\s*\d+\s*(?:\(\s*(\d+)\s*\)|:\s*(\d+))\s*$/) : null;
  if (tail) {
    total = parseInt(tail[1] || tail[2], 10);
    body = body.slice(0, tail.index);
  }
  const parts = body.split(',').map(p => p.trim().replace(/^\.+|\.+$/g, '').trim()).filter(Boolean);
  if (total === null && parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
    total = parseInt(parts.pop()!, 10);
  }
  const terms = parts.map(part => {
    const m = part.match(/^(.*?\D)\s*(\d+)(?:\s*[(:]?\s*\d+\)?)?$/);
    return m && m[1].trim() ? { term: m[1].trim(), count: parseInt(m[2], 10) } : { term: part, count: null };
  });
  return { terms, total };
}

/** « ’elohiym(el-o-heem’) » → translittération + prononciation */
export function parseStrongTransliteration(raw: string): { word: string; pronunciation: string | null } {
  const m = raw.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m ? { word: m[1].trim(), pronunciation: m[2].trim() } : { word: raw.trim(), pronunciation: null };
}

export type StrongOriginPart = string | { code: number };

/**
 * « Vient deguwb01461 » → ["Vient de guwb ", {code: 1461}] : sépare les mots collés
 * et repère les renvois vers d'autres codes (nombres à zéro initial).
 */
export function parseStrongOrigin(raw: string): StrongOriginPart[] {
  const text = raw
    .trim()
    .replace(/(Vient de|Vient du|correspondant à|correspondant au)(?=[^\s,.;])/gu, '$1 ')
    .replace(/(^|\s)(pour|de)(?=[A-Z’])/gu, '$1$2 ')
    .replace(/(\p{L}|’)(0\d{3,4})(?!\d)/gu, '$1 $2');
  const parts: StrongOriginPart[] = [];
  const re = /(?<!\d)0\d{3,4}(?!\d)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ code: parseInt(m[0], 10) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Liens mot ↔ code Strong dans la Segond 1910 (table strong_code_bible_links) ───

/** Codes de livres de la table (OSIS) dans l'ordre biblique, alignés sur books.order_index */
const OSIS_BOOKS = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');
const DB_BOOKS = 'GEN EXO LEV NOM DEU JOS JUG RUT 1SA 2SA 1RO 2RO 1CH 2CH ESD NEH EST JOB PSA PRO ECC CAN ESA JER LAM EZE DAN OSE JOE AMO ABD JON MIC NAH HAB SOP AGG ZAC MAL MAT MAR LUC JEA ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAC 1PE 2PE 1JE 2JE 3JE JUD APO'.split(' ');
const OSIS_BY_DB_CODE = new Map(DB_BOOKS.map((code, i) => [code, OSIS_BOOKS[i]]));

/** Version de la Bible à laquelle correspondent ces liens */
export const STRONG_LINKS_VERSION_CODE = 'LSG';

export interface StrongWordLink {
  word: string;
  code: number | null;
}

/** Windows-1252 → octet, pour les caractères 0x80-0x9F qui diffèrent de Latin-1 */
const CP1252_BYTES: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/** « crÃ©a » → « créa » : texte UTF-8 relu comme du Windows-1252 à l'import */
export function fixMojibake(text: string): string {
  if (!/[ÃÂâ]/.test(text)) return text;
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const byte = code < 0x100 ? code : CP1252_BYTES[ch];
    if (byte === undefined) return text;
    bytes.push(byte);
  }
  try {
    return utf8Decoder.decode(new Uint8Array(bytes));
  } catch {
    return text;
  }
}

const linksCache = new Map<string, Map<number, StrongWordLink[]>>();

/** Mots (dans l'ordre) de chaque verset d'un chapitre, avec leur code Strong éventuel */
export async function getStrongLinksForChapter(dbBookCode: string, chapter: number): Promise<Map<number, StrongWordLink[]>> {
  const osis = OSIS_BY_DB_CODE.get(dbBookCode.toUpperCase());
  const key = `${dbBookCode}:${chapter}`;
  if (!osis) return new Map();
  if (linksCache.has(key)) return linksCache.get(key)!;

  const byVerse = new Map<number, StrongWordLink[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('strong_code_bible_links')
      .select('verset, data_ns, contenu')
      .eq('livre_code', osis)
      .eq('chapitre', chapter)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    (data || []).forEach((row: { verset: number; data_ns: string | null; contenu: string | null }) => {
      if (!row.contenu) return;
      const code = row.data_ns ? parseInt(row.data_ns, 10) : NaN;
      const list = byVerse.get(row.verset) ?? [];
      list.push({ word: fixMojibake(row.contenu), code: Number.isFinite(code) ? code : null });
      byVerse.set(row.verset, list);
    });
    if (!data || data.length < 1000) break;
  }
  linksCache.set(key, byVerse);
  return byVerse;
}

export interface StrongVerseOccurrence {
  chapter: number;
  verse: number;
  /** Mots du verset traduisant ce code (souvent un seul) */
  words: string[];
  /** Référence au format verses.reference_code, ex. GEN.1.1 */
  referenceCode: string;
}

export interface StrongBookOccurrences {
  dbCode: string;
  name: string;
  /** Nombre de mots portant le code dans ce livre */
  count: number;
  verses: StrongVerseOccurrence[];
}

const occurrencesCache = new Map<number, StrongBookOccurrences[]>();

/** Occurrences d'un code Strong dans la Segond 1910, regroupées par livre (ordre biblique) */
export async function getStrongOccurrences(code: number): Promise<StrongBookOccurrences[]> {
  if (occurrencesCache.has(code)) return occurrencesCache.get(code)!;

  type Row = { livre_code: string; livre_nom: string | null; chapitre: number; verset: number; contenu: string | null };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('strong_code_bible_links')
      .select('livre_code, livre_nom, chapitre, verset, contenu')
      .eq('data_ns', String(code))
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data || []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  const books = new Map<string, StrongBookOccurrences & { order: number }>();
  rows.forEach(row => {
    const order = OSIS_BOOKS.indexOf(row.livre_code);
    if (order === -1) return;
    const dbCode = DB_BOOKS[order];
    let book = books.get(dbCode);
    if (!book) {
      book = { dbCode, name: fixMojibake(row.livre_nom || dbCode), count: 0, verses: [], order };
      books.set(dbCode, book);
    }
    book.count++;
    const word = fixMojibake(row.contenu || '').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const last = book.verses[book.verses.length - 1];
    if (last && last.chapter === row.chapitre && last.verse === row.verset) {
      if (word && !last.words.includes(word)) last.words.push(word);
    } else {
      book.verses.push({
        chapter: row.chapitre,
        verse: row.verset,
        words: word ? [word] : [],
        referenceCode: `${dbCode}.${row.chapitre}.${row.verset}`,
      });
    }
  });

  const result = Array.from(books.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...book }) => {
      book.verses.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
      return book;
    });
  occurrencesCache.set(code, result);
  return result;
}

let lsgVersionId: number | null = null;

/** Texte Louis Segond de plusieurs versets, par reference_code (ex. GEN.1.1) */
export async function getLsgVerseTexts(referenceCodes: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (referenceCodes.length === 0) return result;

  if (lsgVersionId === null) {
    const { data } = await supabase.from('bible_versions').select('id').eq('code', STRONG_LINKS_VERSION_CODE).maybeSingle();
    lsgVersionId = data?.id ?? null;
    if (lsgVersionId === null) return result;
  }

  for (let i = 0; i < referenceCodes.length; i += 150) {
    const chunk = referenceCodes.slice(i, i + 150);
    const { data: verses, error } = await supabase
      .from('verses')
      .select('id, reference_code')
      .in('reference_code', chunk);
    if (error || !verses?.length) continue;
    const refById = new Map(verses.map(v => [v.id, v.reference_code]));
    const { data: texts } = await supabase
      .from('verse_texts')
      .select('verse_id, text')
      .eq('version_id', lsgVersionId)
      .in('verse_id', verses.map(v => v.id));
    texts?.forEach(t => {
      const ref = refById.get(t.verse_id);
      if (ref) result.set(ref, t.text);
    });
  }
  return result;
}
