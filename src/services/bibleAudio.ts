import { getDbAllBooks, getDbChapterVerses, getDbVerseTitles, DbBookItem } from '@/services/bibleDb';

// ─── Lecture audio de la Bible (synthèse vocale du navigateur) ───────────────────────────────
// Le texte et les titres viennent des mêmes tables que la page de lecture : rien n'est dupliqué.
// Chaque verset devient une suite de « segments » (annonce, titre, « Verset 2 », texte) lus un
// par un ; pause et reprise repartent du segment en cours, ce qui fonctionne aussi sur Android
// où speechSynthesis.pause() n'est pas fiable.

export type AudioLang = 'fr' | 'en';

export const AUDIO_LANGUAGES: Record<AudioLang, {
  label: string;
  languageId: number;
  defaultVersion: string;
  chapter: string;
  verse: string;
  sample: string;
}> = {
  fr: {
    label: 'Français',
    languageId: 3,
    defaultVersion: 'LSG',
    chapter: 'chapitre',
    verse: 'verset',
    sample: 'Genèse, chapitre 1, verset 1. Au commencement, Dieu créa les cieux et la terre.'
  },
  en: {
    label: 'English',
    languageId: 4,
    defaultVersion: 'KJV',
    chapter: 'chapter',
    verse: 'verse',
    sample: 'Genesis, chapter 1, verse 1. In the beginning God created the heaven and the earth.'
  }
};

export const AUDIO_RATES = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

/** Pause avant et après un titre, entre l'annonce et le texte (ms) */
const TITLE_PAUSE = 650;
const SHORT_PAUSE = 250;

export interface AudioSettings {
  lang: AudioLang;
  /** voiceURI choisie pour chaque langue */
  voices: Partial<Record<AudioLang, string>>;
  /** Version lue pour chaque langue */
  versions: Partial<Record<AudioLang, string>>;
  rate: number;
}

export interface AudioPosition {
  lang: AudioLang;
  bookCode: string;
  chapter: number;
  verse: number;
}

const SETTINGS_KEY = 'bible-audio-settings';
const POSITION_KEY = 'bible-audio-position';

export function readAudioSettings(): AudioSettings {
  const fallback: AudioSettings = { lang: 'fr', voices: {}, versions: {}, rate: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return fallback;
    return {
      lang: saved.lang === 'en' ? 'en' : 'fr',
      voices: saved.voices && typeof saved.voices === 'object' ? saved.voices : {},
      versions: saved.versions && typeof saved.versions === 'object' ? saved.versions : {},
      rate: AUDIO_RATES.includes(saved.rate) ? saved.rate : 1
    };
  } catch {
    return fallback;
  }
}

export function saveAudioSettings(settings: AudioSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* stockage indisponible */ }
}

export function readAudioPosition(): AudioPosition | null {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
    if (!saved?.bookCode || !Number(saved.chapter) || !Number(saved.verse)) return null;
    return { lang: saved.lang === 'en' ? 'en' : 'fr', bookCode: String(saved.bookCode), chapter: Number(saved.chapter), verse: Number(saved.verse) };
  } catch {
    return null;
  }
}

function saveAudioPosition(position: AudioPosition) {
  try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* stockage indisponible */ }
}

// ─── Voix ────────────────────────────────────────────────────────────────────────────────────

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Qualité d'une voix d'après son nom : 2 = neuronale, proche d'une voix humaine
 * (Edge « Online (Natural) », Apple « Premium » / « Améliorée »), 1 = voix Google, 0 = voix classique
 */
export function voiceQuality(voice: SpeechSynthesisVoice): 0 | 1 | 2 {
  if (/natural|neural|premium|enhanced|am[ée]lior[ée]e?|wavenet|studio/i.test(voice.name)) return 2;
  if (/google/i.test(voice.name)) return 1;
  return 0;
}

export function voicesForLang(lang: AudioLang): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis.getVoices()
    .filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang))
    // Voix naturelles d'abord, puis voix locales (elles marchent hors connexion), puis par nom
    .sort((a, b) => voiceQuality(b) - voiceQuality(a)
      || Number(b.localService) - Number(a.localService)
      || a.name.localeCompare(b.name));
}

/** Les voix arrivent parfois après le chargement de la page (Chrome) */
export function onVoicesChanged(callback: () => void): () => void {
  if (!speechSupported()) return () => {};
  window.speechSynthesis.addEventListener('voiceschanged', callback);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback);
}

export function pickVoice(lang: AudioLang, voiceURI?: string): SpeechSynthesisVoice | null {
  const voices = voicesForLang(lang);
  // Sans choix enregistré : la plus naturelle (en tête de liste)
  return voices.find(v => v.voiceURI === voiceURI) ?? voices[0] ?? null;
}

export const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
/** Ouvre les réglages de synthèse vocale d'Android (Chrome comprend les liens « intent: ») */
export const ANDROID_TTS_SETTINGS_URL = 'intent:#Intent;action=com.android.settings.TTS_SETTINGS;end';

// ─── Texte lu ────────────────────────────────────────────────────────────────────────────────

/** Texte prêt à être lu : sans balises ni crochets, espaces normalisés */
const cleanText = (text: string) => text
  .replace(/<[^>]+>/g, ' ')
  .replace(/[[\]{}*_#]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Texte remis à la voix : certaines voix lisent les signes isolés (« deux-points », « point-virgule »,
 * « guillemet ») ou butent sur l'espace française avant « ; : ! ? ». On ne garde que des virgules
 * et des points, qu'aucune voix ne prononce. Le texte affiché n'est pas touché.
 */
export const speakableText = (text: string) => text
  .replace(/[’‘ʼ]/g, "'")
  .replace(/[«»“”„"]/g, '')
  .replace(/\s*[—–]\s*/g, ', ')
  .replace(/\s*[()[\]]\s*/g, ', ')
  .replace(/\s*;\s*/g, ', ')
  // « 3:16 » reste intact ; les autres deux-points deviennent une pause
  .replace(/(?<!\d)\s*:\s*|\s*:\s*(?!\d)/g, ', ')
  .replace(/\s+([,.!?…])/g, '$1')
  .replace(/,(\s*,)+/g, ',')
  .replace(/,\s*([.!?…])/g, '$1')
  .replace(/^[\s,]+|[\s,]+$/g, '')
  .replace(/\s+/g, ' ');

/** « AU COMMENCEMENT » → « Au commencement » : certaines voix épellent les mots en capitales */
const sentenceCase = (text: string) => {
  if (text !== text.toLocaleUpperCase() || !/\p{Lu}{2}/u.test(text)) return text;
  const lower = text.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
};

/** Les longues phrases sont coupées : Chrome interrompt les énoncés de plus de ~15 secondes */
function splitForSpeech(text: string, max = 220): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let current = '';
  for (const piece of text.split(/(?<=[.;:!?,])\s+/)) {
    if (current && (current + ' ' + piece).length > max) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ─── Chapitres ───────────────────────────────────────────────────────────────────────────────

export interface AudioVerse {
  id: number;
  number: number;
  text: string;
  /** Titres placés juste avant le verset, dans l'ordre des niveaux */
  titles: string[];
}

interface AudioChapter {
  book: DbBookItem;
  bookIndex: number;
  chapter: number;
  verses: AudioVerse[];
}

const booksCache = new Map<number, Promise<DbBookItem[]>>();
const getBooks = (languageId: number) => {
  if (!booksCache.has(languageId)) booksCache.set(languageId, getDbAllBooks(languageId));
  return booksCache.get(languageId)!;
};

const chapterCache = new Map<string, Promise<AudioVerse[]>>();
function loadChapterVerses(bookId: number, chapter: number, versionCode: string, languageId: number) {
  const key = `${versionCode}:${bookId}:${chapter}`;
  if (!chapterCache.has(key)) {
    chapterCache.set(key, (async () => {
      const verses = await getDbChapterVerses(bookId, chapter, versionCode);
      const titles = await getDbVerseTitles(verses.map(v => v.id), languageId);
      return verses
        .filter(v => !v.is_missing)
        .map(v => ({
          id: v.id,
          number: v.verse_number,
          text: cleanText(v.text),
          titles: Object.entries(titles[v.id] ?? {})
            // Niveau 5 : références parallèles (« Lu 3.23-38 »), pas un titre à lire ;
            // « (1—11) » : intervalle de chapitres, sans lettre
            .filter(([level, text]) => level !== '5' && /\p{L}/u.test(String(text ?? '')))
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, text]) => sentenceCase(cleanText(String(text))))
        }))
        .filter(v => v.text);
    })());
  }
  const promise = chapterCache.get(key)!;
  promise.then(verses => { if (verses.length === 0) chapterCache.delete(key); });
  return promise;
}

// ─── Lecteur ─────────────────────────────────────────────────────────────────────────────────

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface AudioState {
  status: AudioStatus;
  lang: AudioLang;
  versionCode: string;
  bookCode: string | null;
  bookName: string | null;
  chapter: number | null;
  verse: number | null;
  verseId: number | null;
  /** Le titre placé avant le verset est en cours de lecture */
  readingTitle: boolean;
  error: string | null;
}

interface Segment {
  text: string;
  /** Silence après le segment (ms) */
  pauseAfter: number;
  /** Silence avant le segment (ms) */
  pauseBefore?: number;
  isTitle?: boolean;
}

// Son silencieux en boucle : garde la page « active » écran éteint et donne les commandes de
// l'écran de verrouillage ; s'il est coupé par le système (appel entrant), la lecture se met en pause
function createSilentAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  const sampleRate = 8000;
  const samples = sampleRate; // 1 seconde
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  write(36, 'data'); view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128);
  const audio = new Audio(URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' })));
  audio.loop = true;
  audio.volume = 0.01;
  return audio;
}

export class BibleAudioPlayer {
  private listeners = new Set<(state: AudioState) => void>();
  private settings: AudioSettings = readAudioSettings();
  private state: AudioState = {
    status: 'idle', lang: this.settings.lang, versionCode: '', bookCode: null, bookName: null,
    chapter: null, verse: null, verseId: null, readingTitle: false, error: null
  };
  private chapter: AudioChapter | null = null;
  private verseIndex = 0;
  private segments: Segment[] = [];
  private segmentIndex = 0;
  /** Augmenté à chaque arrêt / saut : les rappels d'une lecture abandonnée sont ignorés */
  private token = 0;
  private timer: number | null = null;
  private silent: HTMLAudioElement | null = null;
  private pausingSilent = false;

  subscribe(listener: (state: AudioState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }

  getState() { return this.state; }
  getSettings() { return this.settings; }

  private setState(patch: Partial<AudioState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l(this.state));
    this.updateMediaSession();
  }

  updateSettings(patch: Partial<AudioSettings>) {
    const langChanged = patch.lang && patch.lang !== this.settings.lang;
    const versionChanged = patch.versions && patch.versions[this.settings.lang] !== this.settings.versions[this.settings.lang];
    const voiceChanged = patch.voices && patch.voices[this.settings.lang] !== this.settings.voices[this.settings.lang];
    this.settings = { ...this.settings, ...patch };
    saveAudioSettings(this.settings);
    this.setState({ lang: this.settings.lang, error: langChanged ? null : this.state.error });
    // Langue, version ou voix changée en cours de lecture : on reprend au même verset
    if (this.state.status === 'playing' && this.chapter && (langChanged || versionChanged || voiceChanged || patch.rate)) {
      const { book, chapter } = this.chapter;
      const verse = this.chapter.verses[this.verseIndex]?.number ?? 1;
      if (langChanged || versionChanged) {
        void this.start(book.code, chapter, verse);
      } else {
        this.speakFromSegment(this.segmentIndex);
      }
    }
  }

  versionFor(lang: AudioLang) {
    return this.settings.versions[lang] || AUDIO_LANGUAGES[lang].defaultVersion;
  }

  /** Lance la lecture à partir d'un verset (le titre placé juste avant est lu en premier) */
  async start(bookCode: string, chapter: number, verse: number) {
    if (!speechSupported()) {
      this.setState({ error: "La synthèse vocale n'est pas disponible dans ce navigateur." });
      return;
    }
    const lang = this.settings.lang;
    if (!pickVoice(lang, this.settings.voices[lang])) {
      this.setState({ error: 'no-voice' });
      return;
    }
    this.stopSpeech();
    const token = this.token;
    // iOS n'autorise la voix que pendant le geste de l'utilisateur : un énoncé vide la débloque
    // avant le chargement du chapitre
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    this.ensureSilentAudio();
    this.setState({ status: 'loading', error: null });

    const loaded = await this.loadChapter(bookCode, chapter);
    if (token !== this.token) return;
    if (!loaded || loaded.verses.length === 0) {
      this.setState({ status: 'idle', error: 'Texte introuvable pour ce chapitre dans la version choisie.' });
      this.releaseSilentAudio();
      return;
    }
    this.chapter = loaded;
    const index = loaded.verses.findIndex(v => v.number >= verse);
    this.playVerse(index === -1 ? 0 : index, true);
  }

  private async loadChapter(bookCode: string, chapter: number): Promise<AudioChapter | null> {
    const lang = this.settings.lang;
    const { languageId } = AUDIO_LANGUAGES[lang];
    const books = await getBooks(languageId);
    const bookIndex = books.findIndex(b => b.code.toUpperCase() === bookCode.toUpperCase());
    if (bookIndex === -1) return null;
    const book = books[bookIndex];
    const verses = await loadChapterVerses(book.id, chapter, this.versionFor(lang), languageId);
    return { book, bookIndex, chapter, verses };
  }

  /** Chapitre suivant ou précédent, en passant au livre voisin si besoin */
  private async neighbourChapter(step: 1 | -1): Promise<AudioChapter | null> {
    if (!this.chapter) return null;
    const books = await getBooks(AUDIO_LANGUAGES[this.settings.lang].languageId);
    let bookIndex = this.chapter.bookIndex;
    let chapter = this.chapter.chapter + step;
    // Chapitre vide dans cette version (ex. Nouveau Testament absent) : on passe au suivant
    for (let guard = 0; guard < 1300; guard++) {
      if (chapter < 1) {
        bookIndex -= 1;
        if (bookIndex < 0) return null;
        chapter = books[bookIndex].chapters_count;
      } else if (chapter > books[bookIndex].chapters_count) {
        bookIndex += 1;
        if (bookIndex >= books.length) return null;
        chapter = 1;
      }
      const loaded = await this.loadChapter(books[bookIndex].code, chapter);
      if (loaded && loaded.verses.length > 0) return loaded;
      chapter += step;
    }
    return null;
  }

  private buildSegments(verse: AudioVerse, announceChapter: boolean): Segment[] {
    const words = AUDIO_LANGUAGES[this.settings.lang];
    const book = this.chapter!.book.name;
    const chapter = this.chapter!.chapter;
    const segments: Segment[] = [];
    const verseWord = words.verse.charAt(0).toLocaleUpperCase() + words.verse.slice(1);
    if (verse.titles.length > 0) {
      // « Genèse, chapitre 1. La création. Verset 1. Au commencement… »
      if (announceChapter) segments.push({ text: `${book}, ${words.chapter} ${chapter}.`, pauseAfter: 0 });
      verse.titles.forEach((title, i) => segments.push({
        text: /[.!?…]$/.test(title) ? title : `${title}.`,
        isTitle: true,
        pauseBefore: i === 0 ? TITLE_PAUSE : SHORT_PAUSE,
        pauseAfter: i === verse.titles.length - 1 ? TITLE_PAUSE : 0
      }));
      segments.push({ text: `${verseWord} ${verse.number}.`, pauseAfter: SHORT_PAUSE });
    } else if (announceChapter) {
      // « Genèse, chapitre 1, verset 1. Au commencement… »
      segments.push({ text: `${book}, ${words.chapter} ${chapter}, ${words.verse} ${verse.number}.`, pauseAfter: SHORT_PAUSE });
    } else {
      segments.push({ text: `${verseWord} ${verse.number}.`, pauseAfter: SHORT_PAUSE });
    }
    splitForSpeech(verse.text).forEach(text => segments.push({ text, pauseAfter: 0 }));
    return segments;
  }

  private playVerse(index: number, announceChapter: boolean) {
    const chapter = this.chapter!;
    const verse = chapter.verses[index];
    this.verseIndex = index;
    this.segments = this.buildSegments(verse, announceChapter);
    this.setState({
      status: 'playing', bookCode: chapter.book.code, bookName: chapter.book.name, chapter: chapter.chapter,
      verse: verse.number, verseId: verse.id, versionCode: this.versionFor(this.settings.lang),
      readingTitle: false
    });
    saveAudioPosition({ lang: this.settings.lang, bookCode: chapter.book.code, chapter: chapter.chapter, verse: verse.number });
    this.speakFromSegment(0);
  }

  private speakFromSegment(index: number) {
    const wasSpeaking = this.stopSpeech();
    const token = this.token;
    this.segmentIndex = index;
    const segment = this.segments[index];
    if (!segment) {
      void this.advance(token);
      return;
    }
    this.setState({ status: 'playing', readingTitle: Boolean(segment.isTitle) });
    const speak = () => {
      if (token !== this.token) return;
      const utterance = new SpeechSynthesisUtterance(speakableText(segment.text));
      const voice = pickVoice(this.settings.lang, this.settings.voices[this.settings.lang]);
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      utterance.rate = this.settings.rate;
      utterance.onend = () => {
        if (token !== this.token) return;
        this.wait(segment.pauseAfter / this.settings.rate, token, () => this.speakFromSegment(index + 1));
      };
      utterance.onerror = (e) => {
        if (token !== this.token || e.error === 'interrupted' || e.error === 'canceled') return;
        this.wait(0, token, () => this.speakFromSegment(index + 1));
      };
      window.speechSynthesis.speak(utterance);
    };
    // Chrome ignore parfois un énoncé lancé juste après cancel() : on laisse passer un instant
    const delay = Math.max(segment.pauseBefore ? segment.pauseBefore / this.settings.rate : 0, wasSpeaking ? 80 : 0);
    if (delay > 0) this.wait(delay, token, speak);
    else speak();
  }

  private wait(ms: number, token: number, next: () => void) {
    if (ms <= 0) { next(); return; }
    this.timer = window.setTimeout(() => { if (token === this.token) next(); }, ms);
  }

  /** Fin du verset : verset suivant, sinon chapitre suivant, sinon livre suivant */
  private async advance(token: number) {
    const chapter = this.chapter!;
    if (this.verseIndex + 1 < chapter.verses.length) {
      this.playVerse(this.verseIndex + 1, false);
      return;
    }
    this.setState({ status: 'loading' });
    const next = await this.neighbourChapter(1);
    if (token !== this.token) return;
    if (!next) { this.stop(); return; }
    this.chapter = next;
    this.playVerse(0, true);
  }

  pause() {
    if (this.state.status !== 'playing' && this.state.status !== 'loading') return;
    this.stopSpeech();
    this.setState({ status: 'paused' });
    this.pauseSilentAudio();
  }

  /** Reprend au segment interrompu (le titre, l'annonce ou la phrase en cours) */
  resume() {
    if (this.state.status !== 'paused' || !this.chapter) return;
    this.ensureSilentAudio();
    this.speakFromSegment(this.segmentIndex);
  }

  stop() {
    this.stopSpeech();
    this.setState({ status: 'idle', readingTitle: false });
    this.releaseSilentAudio();
  }

  async nextVerse() { await this.jump(1); }
  async previousVerse() { await this.jump(-1); }

  private async jump(step: 1 | -1) {
    if (!this.chapter) return;
    const target = this.verseIndex + step;
    if (target >= 0 && target < this.chapter.verses.length) {
      this.playVerse(target, false);
      return;
    }
    this.stopSpeech();
    const token = this.token;
    this.setState({ status: 'loading' });
    const neighbour = await this.neighbourChapter(step);
    if (token !== this.token) return;
    if (!neighbour) { this.playVerse(this.verseIndex, false); return; }
    this.chapter = neighbour;
    this.playVerse(step === 1 ? 0 : neighbour.verses.length - 1, true);
  }

  /** Lit un court exemple avec une voix, sans toucher à la lecture en cours */
  previewVoice(lang: AudioLang, voiceURI?: string) {
    if (!speechSupported()) return;
    this.pause();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(AUDIO_LANGUAGES[lang].sample);
    const voice = pickVoice(lang, voiceURI);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    utterance.rate = this.settings.rate;
    window.speechSynthesis.speak(utterance);
  }

  clearError() { this.setState({ error: null }); }

  /** Coupe la voix et les silences en cours ; indique si une voix parlait */
  private stopSpeech(): boolean {
    this.token += 1;
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    if (!speechSupported()) return false;
    const wasSpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    window.speechSynthesis.cancel();
    return wasSpeaking;
  }

  // ─── Arrière-plan, écran de verrouillage, interruptions ───

  private ensureSilentAudio() {
    if (!this.silent) {
      this.silent = createSilentAudio();
      // Coupé par le système (appel entrant, autre application audio) : pause de la lecture
      this.silent?.addEventListener('pause', () => {
        if (this.pausingSilent) return;
        if (this.state.status === 'playing' || this.state.status === 'loading') this.pause();
      });
    }
    this.silent?.play().catch(() => { /* lecture automatique refusée : la voix marche quand même */ });
    this.setupMediaSession();
  }

  private pauseSilentAudio() {
    if (!this.silent || this.silent.paused) return;
    this.pausingSilent = true;
    this.silent.pause();
    this.pausingSilent = false;
  }

  private releaseSilentAudio() {
    this.pauseSilentAudio();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  private mediaSessionReady = false;
  private setupMediaSession() {
    if (this.mediaSessionReady || !('mediaSession' in navigator)) return;
    this.mediaSessionReady = true;
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => this.resume()],
      ['pause', () => this.pause()],
      ['stop', () => this.stop()],
      ['previoustrack', () => { void this.previousVerse(); }],
      ['nexttrack', () => { void this.nextVerse(); }]
    ];
    handlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* action non gérée */ }
    });
  }

  private updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.state.bookName || typeof MediaMetadata === 'undefined') return;
    const words = AUDIO_LANGUAGES[this.state.lang];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${this.state.bookName} ${this.state.chapter}:${this.state.verse}`,
      artist: `${this.state.versionCode} · ${words.label}`,
      album: 'Bible'
    });
    navigator.mediaSession.playbackState = this.state.status === 'paused' ? 'paused'
      : this.state.status === 'idle' ? 'none' : 'playing';
  }
}

export const bibleAudio = new BibleAudioPlayer();
