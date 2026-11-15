import { supabase } from '@/integrations/supabase/client';
import { getDbBookNameEntries } from '@/services/bibleDb';
import { buildBookNameIndex, parseReferences, BookNameIndex } from '@/utils/bibleReference';
import { UNTRANSLATED_MARKER } from '@/utils/strongLinks';

/** Série de Strong : H = hébreu (Ancien Testament), G = grec (Nouveau Testament) */
export type StrongSerie = 'H' | 'G';

export interface StrongCode {
  serie: StrongSerie;
  code: string;
  content: string;
  mot_original?: string | null;
  origine_mot?: string | null;
  mot_translitere?: string | null;
  type_mot?: string | null;
  traduction_generale?: string | null;
}

const STRONG_COLUMNS = 'serie, code, content, mot_original, origine_mot, mot_translitere, type_mot, traduction_generale';

/** Dernier numéro de chaque série */
export const STRONG_MAX_CODES: Record<StrongSerie, number> = { H: 8853, G: 5944 };

export const STRONG_SERIES: Record<StrongSerie, { label: string; testament: string; language: string }> = {
  H: { label: 'Hébreu', testament: 'Ancien Testament', language: 'hébreu' },
  G: { label: 'Grec', testament: 'Nouveau Testament', language: 'grec' },
};

/** Numéros que Strong n'a jamais attribués dans la série grecque */
const STRONG_GAPS: Record<StrongSerie, (code: number) => boolean> = {
  H: () => false,
  G: code => code === 2717 || (code >= 3203 && code <= 3302),
};

/** Code voisin existant (les numéros jamais attribués sont sautés) ; null au-delà des bornes */
export function neighbourStrongCode(serie: StrongSerie, code: number, step: 1 | -1): number | null {
  for (let next = code + step; next >= 1 && next <= STRONG_MAX_CODES[serie]; next += step) {
    if (!STRONG_GAPS[serie](next)) return next;
  }
  return null;
}

/** « G25 », « H430 », « 430 » (hébreu par défaut) → série et numéro */
export function parseStrongKey(raw: string | null | undefined, fallback: StrongSerie = 'H'): { serie: StrongSerie; code: number } | null {
  const m = (raw ?? '').trim().match(/^([hHgG])?\s*0*(\d{1,5})$/);
  if (!m) return null;
  const serie = (m[1]?.toUpperCase() as StrongSerie | undefined) ?? fallback;
  return { serie, code: parseInt(m[2], 10) };
}

const cache = new Map<string, StrongCode>();
const cacheKey = (serie: StrongSerie, code: string | number) => `${serie}${String(code).trim()}`;
const remember = (row: StrongCode) => cache.set(cacheKey(row.serie, row.code), row);

/**
 * Codes d'une plage numérique d'une série (ex. H1 → H100). La colonne `code` est du texte :
 * on interroge la liste exacte des numéros puis on trie numériquement.
 */
export async function getStrongCodesRange(serie: StrongSerie, from: number, to: number): Promise<StrongCode[]> {
  const codes: string[] = [];
  for (let n = from; n <= to; n++) codes.push(String(n));

  const missing = codes.filter(c => !cache.has(cacheKey(serie, c)));
  for (let i = 0; i < missing.length; i += 200) {
    const chunk = missing.slice(i, i + 200);
    const { data, error } = await supabase
      .from('strong_codes')
      .select(STRONG_COLUMNS)
      .eq('serie', serie)
      .in('code', chunk);
    if (error) throw error;
    (data || []).forEach((row: StrongCode) => remember(row));
  }

  return codes.map(c => cache.get(cacheKey(serie, c))).filter((row): row is StrongCode => !!row);
}

export async function getStrongCode(serie: StrongSerie, code: string | number): Promise<StrongCode | null> {
  const key = String(code).trim();
  if (cache.has(cacheKey(serie, key))) return cache.get(cacheKey(serie, key))!;
  const { data, error } = await supabase
    .from('strong_codes')
    .select(STRONG_COLUMNS)
    .eq('serie', serie)
    .eq('code', key)
    .maybeSingle();
  if (error) throw error;
  if (data) remember(data as StrongCode);
  return (data as StrongCode) || null;
}

/** Recherche dans les définitions, traductions, translittérations et mots originaux d'une série (200 résultats max, triés par numéro) */
export async function searchStrongCodes(serie: StrongSerie, query: string): Promise<StrongCode[]> {
  const term = query.trim().replace(/[%_,()]/g, ' ');
  if (!term) return [];
  const { data, error } = await supabase
    .from('strong_codes')
    .select(STRONG_COLUMNS)
    .eq('serie', serie)
    .or(['content', 'traduction_generale', 'mot_translitere', 'mot_original']
      .map(col => `${col}.ilike.%${term}%`).join(','))
    .limit(200);
  if (error) throw error;
  const rows = (data || []) as StrongCode[];
  rows.forEach(remember);
  return rows.sort((a, b) => Number(a.code) - Number(b.code));
}

const ALLOWED_TAGS = new Set(['P', 'OL', 'UL', 'LI', 'SUP', 'SUB', 'B', 'STRONG', 'I', 'EM', 'BR', 'SPAN']);

/**
 * Nettoie le HTML importé : retire les guillemets d'encadrement, les <tr>/<td>,
 * les attributs (onclick…) et les liens externes ; ne garde que les balises de mise en forme.
 */
const LIST_STYLES: Record<string, string> = {
  '1': 'decimal',
  a: 'lower-alpha',
  A: 'upper-alpha',
  i: 'lower-roman',
  I: 'upper-roman',
};

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
      const quickPick = child.getAttribute('onclick')?.match(/quick_pick\(\s*'([^']+)'\s*,\s*'(\d+)'\s*,\s*'(\d+)'/);
      if (quickPick) {
        // Renvoi vers un verset (« Job 31.12 ») : lien résolu au clic (resolveStrongReference)
        const link = doc.createElement('a');
        link.className = 'strong-ref';
        link.setAttribute('data-ref', `${quickPick[1]} ${quickPick[2]}:${quickPick[3]}`);
        link.setAttribute('href', '#');
        link.append(...Array.from(child.childNodes));
        child.replaceWith(link);
      } else if (child.tagName === 'A' || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') {
        // Liens « Définition » vers un site externe : supprimés
        child.remove();
      } else if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
      } else {
        const listType = child.tagName === 'OL' ? child.getAttribute('type') : null;
        Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
        // Numérotation de la liste telle que dans la base (1, a, A, i, I) ; « type » ne distingue pas
        // les majuscules en CSS, on passe donc par un attribut dédié
        const listStyle = listType ? LIST_STYLES[listType] : undefined;
        if (listStyle) {
          child.setAttribute('type', listType!);
          child.setAttribute('data-list', listStyle);
        }
      }
    });
  };
  clean(root);
  return root.innerHTML.trim();
}

let bookIndexPromise: Promise<BookNameIndex> | null = null;

/** « Job 31:12 » → « JOB.31.12 » (code de verset de la page Lecture), null si le livre est inconnu */
export async function resolveStrongReference(reference: string): Promise<string | null> {
  bookIndexPromise ??= getDbBookNameEntries().then(buildBookNameIndex);
  const [first] = parseReferences(reference, await bookIndexPromise);
  return first?.referenceCode ?? null;
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

export type StrongOriginPart = string | { code: number; serie: StrongSerie };

/** Renvoi vers un code dans l'origine : zéro initial puis le numéro, collé au mot (’ab01 = H1, yada`03045 = H3045) */
const ORIGIN_CODE = /(?<!\d)0(\d{1,4})(?!\d)/g;
/** Petits mots français suivis d'un mot translittéré */
const ORIGIN_LINK_WORDS = 'de|du|des|que|à|au|pour|comme|mot|et|avec|ou';

/**
 * « De’ab01etYahh03050 » → ["De ’ab", {code: 1}, " et Yahh", {code: 3050}] : sépare les mots collés
 * et repère les renvois vers d'autres codes, où qu'ils soient dans le texte.
 */
export function parseStrongOrigin(raw: string, serie: StrongSerie = 'H'): StrongOriginPart[] {
  if (serie === 'G') return parseGreekOrigin(raw);
  const text = raw
    .trim()
    .replace(/(Vient de|Vient du|correspondant à|correspondant au)(?=[^\s,.;])/gu, '$1 ')
    // « De’ab », « à’eb » (mais pas « d’une », « s’agenouiller »)
    .replace(new RegExp(`(^|[\\s,(])(${ORIGIN_LINK_WORDS})(?=[’'\`]\\p{L})`, 'giu'), '$1$2 ')
    // « denagan05059 », « pourdera`01872 », « queneharah05105 » : mot français collé au mot translittéré
    // « deYahh », « pourMolek » : une majuscule ne continue pas un mot français
    .replace(/(^|\s)(pour|que|de)(?=\p{Lu})/gu, '$1$2 ')
    .replace(/(^|\s)(pour|que|de)(?=[\p{L}`’'][^\s;]*?(?:\p{L}[`’']?0\d{1,4}(?!\d)|,))/giu, (all, before, word, offset, whole) => {
      // Seulement après un mot français (« vient denagan », « même mot queneharah ») :
      // « de derek0… » ou « diyn, duwn0… » sont déjà des mots translittérés
      const previous = whole.slice(0, offset).trimEnd();
      const previousWord = previous.split(/\s+/).pop()?.toLowerCase() ?? '';
      if (/[,)]$/.test(previous) || /^(de|du|des|que|pour|à|au|et|ou)$/i.test(previousWord)) return all;
      return `${before}${word} `;
    })
    // Après un code : « 01etYahh » → « 01 et Yahh », « 056à travers » → « 056 à travers »
    .replace(/((?<!\d)0\d{1,4})(?!\d)(et)(?=[^\s,.;])/gu, '$1 $2 ')
    .replace(/((?<!\d)0\d{1,4})(?![\d\s,.;:)])/gu, '$1 ');
  const parts: StrongOriginPart[] = [];
  let last = 0;
  for (const m of text.matchAll(ORIGIN_CODE)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ code: parseInt(m[1], 10), serie: 'H' });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Origine d'un mot grec : « Vient de a 1 et baros 922 » renvoie aux codes grecs G1 et G922 ;
 * un numéro précédé d'un zéro est un code hébreu (« Mot hébreu : ’Aharown 0175 » = H175).
 */
function parseGreekOrigin(raw: string): StrongOriginPart[] {
  const text = raw.trim();
  const parts: StrongOriginPart[] = [];
  let last = 0;
  // Nombre isolé (pas un verset « 31.12 » ni « 3:16 »)
  for (const m of text.matchAll(/(?<![\d.:])(0?)(\d{1,4})(?![\d.:]?\d)/g)) {
    const code = parseInt(m[2], 10);
    if (code < 1) continue;
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ code, serie: m[1] ? 'H' : 'G' });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Liens mot ↔ code Strong dans la Segond 1910 (table strong_code_bible_links) ───

/** Codes de livres de la table (OSIS) dans l'ordre biblique, alignés sur books.order_index */
const OSIS_BOOKS = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');
const DB_BOOKS = 'GEN EXO LEV NOM DEU JOS JUG RUT 1SA 2SA 1RO 2RO 1CH 2CH ESD NEH EST JOB PSA PRO ECC CAN ESA JER LAM EZE DAN OSE JOE AMO ABD JON MIC NAH HAB SOP AGG ZAC MAL MAT MAR LUC JEA ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAC 1PE 2PE 1JE 2JE 3JE JUD APO'.split(' ');
const OSIS_BY_DB_CODE = new Map(DB_BOOKS.map((code, i) => [code, OSIS_BOOKS[i]]));
/** Les 39 premiers livres forment l'Ancien Testament (codes hébreux), les 27 suivants le Nouveau (codes grecs) */
const OSIS_BY_SERIE: Record<StrongSerie, string[]> = { H: OSIS_BOOKS.slice(0, 39), G: OSIS_BOOKS.slice(39) };
const serieOfOsisBook = (osis: string): StrongSerie => (OSIS_BOOKS.indexOf(osis) >= 39 ? 'G' : 'H');

/** Série des codes Strong d'un livre (code de la base : GEN, MAT…) : hébreu pour l'AT, grec pour le NT */
export function strongSerieOfBook(dbBookCode: string): StrongSerie {
  return DB_BOOKS.indexOf(dbBookCode.toUpperCase()) >= 39 ? 'G' : 'H';
}

/** Version de la Bible à laquelle correspondent les pages Code Strong (occurrences, formes du mot) */
export const STRONG_LINKS_VERSION_CODE = 'LSG';

/**
 * Versions de la base (bible_versions.code) qui ont des codes Strong, et valeur de la colonne
 * strong_code_bible_links.version correspondante. Ajouter une ligne ici quand une version est importée.
 */
const STRONG_LINK_VERSIONS: Record<string, string> = {
  LSG: 'Sg1910', KJV: 'KJV', DBY90: 'DBY90', DBY91: 'DarbyR', WLC: 'WLC', WLCT: 'WLCt',
};

/** La version (code de la base : LSG, KJV…) a-t-elle des codes Strong ? */
export function hasStrongLinks(versionCode: string | null | undefined): boolean {
  return Boolean(versionCode && STRONG_LINK_VERSIONS[versionCode.toUpperCase()]);
}

/** Versions ayant des codes Strong, ex. « LSG, KJV ou DBY90 » (messages) */
export const STRONG_LINKS_VERSION_LABEL = Object.keys(STRONG_LINK_VERSIONS)
  .join(', ')
  .replace(/, ([^,]+)$/, ' ou $1');

/** Valeur de strong_code_bible_links.version des pages Code Strong (Segond 1910) */
const STRONG_PAGES_LINK_VERSION = STRONG_LINK_VERSIONS[STRONG_LINKS_VERSION_CODE];

export interface StrongWordLink {
  word: string;
  /** Codes du mot, dans l'ordre (souvent un seul ; « Égyptiens » = 1121, 4714) ; vide = mot sans code */
  codes: number[];
}

/** « 1121, 4714 » → [1121, 4714] : un mot peut traduire plusieurs mots hébreux (doublons retirés) */
export function parseStrongCodeList(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const codes = raw.split(/[^0-9]+/).map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0);
  return [...new Set(codes)];
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
  // « Ã© » (é), « â€™ » (’), « Å“ » (œ)…
  if (!/[ÃÂâÅ]/.test(text)) return text;
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

/**
 * Segond 1910 et Darby française : mots consécutifs d'un verset portant le même code (« jusqu' à ce que » = H5704).
 * Les fichiers public/data/strong-groupes-lsg.json et strong-groupes-dby91.json
 * (scripts/strong_groupes_lsg.py [--version DarbyR], d'après les mots
 * KJV du même code) indique, par verset (« Gen.3.19 »), les suites de mots à n'afficher qu'avec un code :
 *   [début, fin]     locution entière : un seul mot « jusqu'à ce que », code après la locution
 *   [début, fin, 1]  code gardé sur le dernier mot seulement
 * Indices dans la liste des mots du verset (lignes avec contenu, dans l'ordre des id). Affichage seulement.
 */
type StrongGroupRange = [number, number] | [number, number, number];
/** Fichier de groupes de chaque version (strong_code_bible_links.version) : Segond 1910 et Darby française */
const STRONG_GROUP_FILES: Record<string, string> = { Sg1910: 'strong-groupes-lsg.json', DarbyR: 'strong-groupes-dby91.json' };
const groupsPromises = new Map<string, Promise<Record<string, StrongGroupRange[]>>>();
function getStrongGroups(linkVersion: string): Promise<Record<string, StrongGroupRange[]>> {
  const file = STRONG_GROUP_FILES[linkVersion];
  if (!file) return Promise.resolve({});
  if (!groupsPromises.has(file)) {
    groupsPromises.set(file, fetch(`${import.meta.env.BASE_URL}data/${file}`)
      .then(res => (res.ok ? res.json() : {}))
      .catch(() => ({})));
  }
  return groupsPromises.get(file)!;
}

/** Locution : « jusqu’ » + « à » → « jusqu’à » ; « Tiglath- » + « Piléser » → « Tiglath-Piléser » ; sinon une espace */
function joinLocution(words: string[]): string {
  return words.reduce((acc, w) => (!acc ? w : /['’\-]$/.test(acc) ? acc + w : `${acc} ${w}`), '');
}

function applyStrongGroups(words: StrongWordLink[], ranges: StrongGroupRange[]): StrongWordLink[] {
  const result = [...words];
  // De la fin vers le début : les indices des groupes précédents restent valables
  [...ranges].sort((a, b) => b[0] - a[0]).forEach(([start, end, lastOnly]) => {
    if (start < 0 || end >= result.length || end <= start) return;
    if (lastOnly) {
      for (let k = start; k < end; k++) result[k] = { ...result[k], codes: [] };
      return;
    }
    const parts = result.slice(start, end + 1);
    const text = joinLocution(parts.map(p => p.word.trim()).filter(w => w && w !== UNTRANSLATED_MARKER));
    result.splice(start, end - start + 1, { word: text || UNTRANSLATED_MARKER, codes: parts[parts.length - 1].codes });
  });
  return result;
}

/** Mots (dans l'ordre) de chaque verset d'un chapitre d'une version (LSG, KJV…), avec leur code Strong éventuel */
export async function getStrongLinksForChapter(
  dbBookCode: string,
  chapter: number,
  versionCode: string = STRONG_LINKS_VERSION_CODE
): Promise<Map<number, StrongWordLink[]>> {
  const osis = OSIS_BY_DB_CODE.get(dbBookCode.toUpperCase());
  const linkVersion = STRONG_LINK_VERSIONS[versionCode.toUpperCase()];
  const key = `${versionCode.toUpperCase()}:${dbBookCode}:${chapter}`;
  if (!osis || !linkVersion) return new Map();
  if (linksCache.has(key)) return linksCache.get(key)!;

  const byVerse = new Map<number, StrongWordLink[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('strong_code_bible_links')
      .select('verset, data_ns, contenu')
      .eq('version', linkVersion)
      .eq('livre_code', osis)
      .eq('chapitre', chapter)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    (data || []).forEach((row: { verset: number; data_ns: string | null; contenu: string | null }) => {
      if (!row.contenu) return;
      const list = byVerse.get(row.verset) ?? [];
      list.push({ word: fixMojibake(row.contenu), codes: parseStrongCodeList(row.data_ns) });
      byVerse.set(row.verset, list);
    });
    if (!data || data.length < 1000) break;
  }
  if (STRONG_GROUP_FILES[linkVersion]) {
    // Segond, Darby française : un seul code par locution (« jusqu'à ce que » H5704), d'après la King James
    const groups = await getStrongGroups(linkVersion);
    byVerse.forEach((words, verse) => {
      const ranges = groups[`${osis}.${chapter}.${verse}`];
      if (ranges) byVerse.set(verse, applyStrongGroups(words, ranges));
    });
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

const occurrencesCache = new Map<string, StrongBookOccurrences[]>();

/** Occurrences d'un code Strong dans la Segond 1910, regroupées par livre (ordre biblique) */
type StrongLinkRow = { id: number; livre_code: string; livre_nom: string | null; chapitre: number; verset: number; contenu: string | null; data_lm: string | null; data_ns: string | null };
const LINK_ROW_COLUMNS = 'id, livre_code, livre_nom, chapitre, verset, contenu, data_lm, data_ns';
const linkRowsCache = new Map<string, Promise<StrongLinkRow[]>>();

/** Lignes à plusieurs codes (« 1121, 4714 », quelques centaines) : lues une seule fois pour tous les codes */
let multiCodeRowsPromise: Promise<StrongLinkRow[]> | null = null;
function getMultiCodeLinkRows(): Promise<StrongLinkRow[]> {
  if (!multiCodeRowsPromise) {
    multiCodeRowsPromise = (async () => {
      const rows: StrongLinkRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('strong_code_bible_links')
          .select(LINK_ROW_COLUMNS)
          .eq('version', STRONG_PAGES_LINK_VERSION)
          .like('data_ns', '%,%')
          .order('id', { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...((data || []) as StrongLinkRow[]));
        if (!data || data.length < 1000) break;
      }
      return rows;
    })().catch(err => { multiCodeRowsPromise = null; throw err; });
  }
  return multiCodeRowsPromise;
}

/**
 * Toutes les lignes de strong_code_bible_links d'un code, seul ou avec d'autres (lues une seule fois).
 * Les numéros hébreux et grecs se chevauchent : H11 est cherché dans l'AT, G11 dans le NT.
 */
function getStrongLinkRows(serie: StrongSerie, code: number): Promise<StrongLinkRow[]> {
  const key = `${serie}${code}`;
  if (!linkRowsCache.has(key)) {
    linkRowsCache.set(key, (async () => {
      const rows: StrongLinkRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('strong_code_bible_links')
          .select(LINK_ROW_COLUMNS)
          .eq('version', STRONG_PAGES_LINK_VERSION)
          .eq('data_ns', String(code))
          .in('livre_code', OSIS_BY_SERIE[serie])
          .order('id', { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...((data || []) as StrongLinkRow[]));
        if (!data || data.length < 1000) break;
      }
      const shared = (await getMultiCodeLinkRows())
        .filter(row => serieOfOsisBook(row.livre_code) === serie && parseStrongCodeList(row.data_ns).includes(code));
      return [...rows, ...shared].sort((a, b) => a.id - b.id);
    })().catch(err => { linkRowsCache.delete(key); throw err; }));
  }
  return linkRowsCache.get(key)!;
}

export interface StrongWordOccurrence {
  /** Code du livre dans la base (GEN, EXO…) et nom du livre */
  dbCode: string;
  bookName: string;
  bookOrder: number;
  chapter: number;
  verse: number;
  /** Format verses.reference_code, ex. GEN.1.1 */
  referenceCode: string;
}

/** Libellé des emplois où le mot hébreu n'est pas traduit en français (« ◎ » dans la source) */
export const STRONG_UNTRANSLATED_WORD = '(non traduit)';

export interface StrongWordForm {
  /** Mot tel qu'il apparaît dans la Segond 1910 (forme la plus fréquente), ex. « pères » */
  word: string;
  /** Nombre d'occurrences du mot portant ce code */
  count: number;
  occurrences: StrongWordOccurrence[];
}

/**
 * Mots de la Segond 1910 qui portent ce code Strong (table strong_code_bible_links),
 * regroupés par forme (« père », « pères »… ; sans tenir compte des majuscules), du plus fréquent au moins fréquent.
 */
export async function getStrongWordForms(code: number, serie: StrongSerie = 'H'): Promise<StrongWordForm[]> {
  const forms = new Map<string, { variants: Map<string, number>; occurrences: StrongWordOccurrence[] }>();
  (await getStrongLinkRows(serie, code)).forEach(row => {
    const order = OSIS_BOOKS.indexOf(row.livre_code);
    const raw = fixMojibake(row.contenu || '').trim();
    // Ponctuation autour du mot retirée ; un signe seul portant un code (« , » H5921) est gardé tel quel
    // « ◎ » : mot hébreu sans mot français correspondant, compté à part
    const word = raw.includes('◎')
      ? STRONG_UNTRANSLATED_WORD
      : (raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || raw).replace(/\s+/g, ' ');
    if (order === -1 || !word) return;
    const key = word.toLocaleLowerCase('fr');
    const form = forms.get(key) ?? { variants: new Map<string, number>(), occurrences: [] };
    form.variants.set(word, (form.variants.get(word) ?? 0) + 1);
    const dbCode = DB_BOOKS[order];
    form.occurrences.push({
      dbCode,
      bookName: fixMojibake(row.livre_nom || dbCode),
      bookOrder: order,
      chapter: row.chapitre,
      verse: row.verset,
      referenceCode: `${dbCode}.${row.chapitre}.${row.verset}`,
    });
    forms.set(key, form);
  });
  return Array.from(forms.values())
    .map(form => ({
      word: [...form.variants.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: form.occurrences.length,
      occurrences: form.occurrences.sort((a, b) => a.bookOrder - b.bookOrder || a.chapter - b.chapter || a.verse - b.verse),
    }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'fr'));
}

export async function getStrongOccurrences(code: number, serie: StrongSerie = 'H'): Promise<StrongBookOccurrences[]> {
  const key = `${serie}${code}`;
  if (occurrencesCache.has(key)) return occurrencesCache.get(key)!;

  const rows = await getStrongLinkRows(serie, code);

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
  occurrencesCache.set(key, result);
  return result;
}

export interface LsgVersionInfo {
  id: number;
  code: string;
  code_display: string | null;
  name: string;
  language_id: number;
}

let lsgVersionPromise: Promise<LsgVersionInfo | null> | null = null;

/** Version Louis Segond (LSG) telle qu'enregistrée dans bible_versions (identifiant, code affiché, nom) */
export function getLsgVersion(): Promise<LsgVersionInfo | null> {
  if (!lsgVersionPromise) {
    lsgVersionPromise = Promise.resolve(
      supabase.from('bible_versions').select('id, code, code_display, name, language_id').eq('code', STRONG_LINKS_VERSION_CODE).maybeSingle()
    ).then(({ data }) => (data as LsgVersionInfo) ?? null);
  }
  return lsgVersionPromise;
}

/** Identifiant de la version Louis Segond (LSG) */
export async function getLsgVersionId(): Promise<number | null> {
  return (await getLsgVersion())?.id ?? null;
}

/** Texte Louis Segond de plusieurs versets, par reference_code (ex. GEN.1.1) */
export async function getLsgVerseTexts(referenceCodes: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (referenceCodes.length === 0) return result;

  const lsgVersionId = await getLsgVersionId();
  if (lsgVersionId === null) return result;

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
