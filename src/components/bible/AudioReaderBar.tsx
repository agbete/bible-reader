import React, { useEffect, useState } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward, Settings2, X, Loader2, Volume2, AlertTriangle, ExternalLink, History
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  bibleAudio, AudioState, AudioLang, AudioSettings, AUDIO_LANGUAGES, AUDIO_RATES,
  voicesForLang, voiceQuality, onVoicesChanged, pickVoice, readAudioPosition, isAndroid, isIOS, ANDROID_TTS_SETTINGS_URL
} from '@/services/bibleAudio';
import type { DbBibleVersion } from '@/services/bibleDb';

export function useBibleAudio() {
  const [state, setState] = useState<AudioState>(bibleAudio.getState());
  const [settings, setSettings] = useState<AudioSettings>(bibleAudio.getSettings());
  useEffect(() => bibleAudio.subscribe(next => {
    setState(next);
    setSettings(bibleAudio.getSettings());
  }), []);
  return { state, settings };
}

/** Voix disponibles, mises à jour quand le navigateur finit de les charger */
function useVoices(lang: AudioLang) {
  const [voices, setVoices] = useState(() => voicesForLang(lang));
  /** Liste définitive : on ne signale l'absence de voix qu'une fois le chargement terminé */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setVoices(voicesForLang(lang));
    // Certaines plateformes n'émettent jamais « voiceschanged » : on relit une fois après un délai
    const timer = window.setTimeout(() => { setVoices(voicesForLang(lang)); setReady(true); }, 1200);
    const off = onVoicesChanged(() => setVoices(voicesForLang(lang)));
    return () => { window.clearTimeout(timer); off(); };
  }, [lang]);
  return { voices, ready };
}

interface AudioReaderBarProps {
  /** Livre et chapitre affichés : point de départ de la lecture */
  bookCode: string | null;
  chapter: number;
  verseNumbers: number[];
  versions: DbBibleVersion[];
  onClose: () => void;
}

const iconButton = 'h-[34px] w-[34px] rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none';

export const AudioReaderBar: React.FC<AudioReaderBarProps> = ({ bookCode, chapter, verseNumbers, versions, onClose }) => {
  const { state, settings } = useBibleAudio();
  const [startVerse, setStartVerse] = useState(1);
  const [savedPosition, setSavedPosition] = useState(readAudioPosition);
  const { voices, ready: voicesReady } = useVoices(settings.lang);
  const lang = settings.lang;
  const active = state.status !== 'idle';
  const noVoice = voices.length === 0 && (state.error === 'no-voice' || voicesReady);

  // Nouveau chapitre affiché : la lecture repartira de son premier verset
  useEffect(() => { setStartVerse(verseNumbers[0] ?? 1); }, [bookCode, chapter, verseNumbers[0]]);
  useEffect(() => { if (state.status === 'idle') setSavedPosition(readAudioPosition()); }, [state.status]);

  const languageVersions = versions.filter(v => v.language_id === AUDIO_LANGUAGES[lang].languageId);
  const versionCode = bibleAudio.versionFor(lang);
  const currentVoice = pickVoice(lang, settings.voices[lang]);

  const handlePlay = () => {
    if (state.status === 'playing' || state.status === 'loading') bibleAudio.pause();
    else if (state.status === 'paused') bibleAudio.resume();
    else if (bookCode) void bibleAudio.start(bookCode, chapter, startVerse);
  };

  const resumeSaved = () => {
    if (!savedPosition) return;
    if (savedPosition.lang !== lang) bibleAudio.updateSettings({ lang: savedPosition.lang });
    void bibleAudio.start(savedPosition.bookCode, savedPosition.chapter, savedPosition.verse);
  };

  const reference = active && state.bookName
    ? `${state.bookName} ${state.chapter}:${state.verse}`
    : null;
  const showResume = !active && savedPosition
    && !(savedPosition.bookCode === bookCode && savedPosition.chapter === chapter && savedPosition.verse === startVerse);

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-amber-500/30 bg-gradient-to-r from-[#78350F] via-[#92400E] to-[#78350F] text-white shadow-[0_-8px_30px_rgba(0,0,0,0.25)]">
      {state.error && state.error !== 'no-voice' && (
        <div className="px-[10px] py-1 bg-rose-900/80 text-[12px] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{state.error}</span>
          <button type="button" onClick={() => bibleAudio.clearError()} aria-label="Fermer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {noVoice && <NoVoiceNotice lang={lang} />}

      <div className="px-[10px] py-1.5 flex items-center gap-[10px] max-w-6xl mx-auto">
        {/* Position */}
        <div className="min-w-0 flex-1 leading-tight">
          {reference ? (
            <>
              <div className="font-cambria font-bold text-[15px] truncate">{reference}</div>
              <div className="text-[11px] text-amber-200/90 truncate">
                {state.status === 'loading' ? 'Chargement…' : state.status === 'paused' ? 'En pause' : state.readingTitle ? 'Lecture du titre' : 'Lecture en cours'}
                {' · '}{versionCode} · {AUDIO_LANGUAGES[lang].label}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[12px] flex-wrap">
              <label className="flex items-center gap-1 text-amber-100">
                Depuis le verset
                <select
                  value={startVerse}
                  onChange={e => setStartVerse(Number(e.target.value))}
                  className="h-6 rounded-md bg-white/15 px-1 text-white font-bold outline-none [&>option]:text-foreground [&>option]:bg-background"
                >
                  {(verseNumbers.length ? verseNumbers : [1]).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {showResume && (
                <button
                  type="button"
                  onClick={resumeSaved}
                  className="flex items-center gap-1 h-6 px-2 rounded-full bg-white/10 hover:bg-white/20 text-amber-100 truncate max-w-[14rem]"
                  title="Reprendre là où la lecture s'est arrêtée"
                >
                  <History className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Reprendre {savedPosition!.bookCode} {savedPosition!.chapter}:{savedPosition!.verse}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Commandes */}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => void bibleAudio.previousVerse()} disabled={!active} className={`${iconButton} hover:bg-white/15`} title="Verset précédent" aria-label="Verset précédent">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handlePlay}
            disabled={!bookCode && !active}
            className={`${iconButton} h-[42px] w-[42px] bg-amber-400 text-[#78350F] hover:bg-amber-300 shadow-md`}
            title={state.status === 'playing' ? 'Pause' : state.status === 'paused' ? 'Reprendre' : 'Lecture'}
            aria-label={state.status === 'playing' ? 'Pause' : state.status === 'paused' ? 'Reprendre' : 'Lecture'}
          >
            {state.status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" />
              : state.status === 'playing' ? <Pause className="w-5 h-5 fill-current" />
              : <Play className="w-5 h-5 fill-current translate-x-[1px]" />}
          </button>
          <button type="button" onClick={() => void bibleAudio.nextVerse()} disabled={!active} className={`${iconButton} hover:bg-white/15`} title="Verset suivant" aria-label="Verset suivant">
            <SkipForward className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => bibleAudio.stop()} disabled={!active} className={`${iconButton} hover:bg-white/15`} title="Arrêter" aria-label="Arrêter">
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>

        {/* Vitesse, langue, voix */}
        <div className="flex items-center gap-1 shrink-0 justify-end flex-1">
          <select
            value={settings.rate}
            onChange={e => bibleAudio.updateSettings({ rate: Number(e.target.value) })}
            className="h-[26px] rounded-full bg-white/15 px-2 text-[12px] font-bold text-white outline-none [&>option]:text-foreground [&>option]:bg-background"
            title="Vitesse de lecture"
            aria-label="Vitesse de lecture"
          >
            {AUDIO_RATES.map(rate => <option key={rate} value={rate}>{rate}×</option>)}
          </select>
          <button
            type="button"
            onClick={() => bibleAudio.updateSettings({ lang: lang === 'fr' ? 'en' : 'fr' })}
            className="h-[26px] px-2 rounded-full bg-white/15 hover:bg-white/25 text-[12px] font-bold uppercase"
            title={`Langue de lecture : ${AUDIO_LANGUAGES[lang].label} (cliquer pour changer)`}
          >
            {lang}
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={`${iconButton} hover:bg-white/15`} title="Langue, voix et version" aria-label="Réglages de la lecture audio">
                <Settings2 className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[min(22rem,calc(100vw-20px))] p-0 overflow-hidden">
              <div className="px-[10px] py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-cambria font-bold text-[15px] leading-tight">
                Lecture audio
              </div>
              <div className="p-[10px] space-y-3 text-[13px]">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">Langue</div>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(AUDIO_LANGUAGES) as AudioLang[]).map(code => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => bibleAudio.updateSettings({ lang: code })}
                        className={`h-8 rounded-md font-semibold transition-colors ${code === lang ? 'bg-amber-600 text-white' : 'bg-muted hover:bg-amber-500/15'}`}
                      >
                        {AUDIO_LANGUAGES[code].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">Version lue</div>
                  <select
                    value={versionCode}
                    onChange={e => bibleAudio.updateSettings({ versions: { ...settings.versions, [lang]: e.target.value } })}
                    className="w-full h-8 rounded-md bg-muted px-2 outline-none"
                  >
                    {languageVersions.length === 0 && <option value={versionCode}>{versionCode}</option>}
                    {languageVersions.map(v => <option key={v.code} value={v.code}>{v.code} — {v.name}</option>)}
                  </select>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
                    Voix ({voices.length})
                  </div>
                  {voices.length > 0 && !voices.some(v => voiceQuality(v) === 2) && (
                    <div className="mb-1.5 rounded-md bg-amber-500/10 p-2 text-[11px] leading-snug">
                      Pour une voix plus humaine :{' '}
                      {isIOS()
                        ? 'téléchargez une voix « Améliorée » ou « Premium » dans Réglages › Accessibilité › Contenu énoncé › Voix.'
                        : isAndroid()
                          ? 'installez les voix haute qualité de Google dans les réglages de synthèse vocale.'
                          : 'ouvrez la Bible dans Microsoft Edge, qui propose les voix « Natural » (Denise, Henri, Vivienne…).'}
                    </div>
                  )}
                  {voices.length === 0 ? (
                    <NoVoiceNotice lang={lang} inline />
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                      {voices.map(voice => {
                        const selected = voice.voiceURI === currentVoice?.voiceURI;
                        return (
                          <div key={voice.voiceURI} className={`flex items-center gap-2 px-2 py-1 ${selected ? 'bg-amber-500/15' : ''}`}>
                            <button
                              type="button"
                              onClick={() => bibleAudio.updateSettings({ voices: { ...settings.voices, [lang]: voice.voiceURI } })}
                              className="flex-1 min-w-0 text-left leading-tight"
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={`truncate ${selected ? 'font-bold text-amber-800 dark:text-amber-200' : ''}`}>{voice.name}</span>
                                {voiceQuality(voice) === 2 && (
                                  <span className="shrink-0 px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-4">Naturelle</span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {voice.lang}{voice.localService ? '' : ' · en ligne'}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => bibleAudio.previewVoice(lang, voice.voiceURI)}
                              className="shrink-0 h-7 px-2 rounded-full bg-muted hover:bg-amber-500/20 text-[11px] font-semibold flex items-center gap-1"
                              title="Écouter un exemple"
                            >
                              <Volume2 className="w-3.5 h-3.5" /> Exemple
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={() => { bibleAudio.stop(); onClose(); }}
            className={`${iconButton} hover:bg-white/15`}
            title="Fermer la lecture audio"
            aria-label="Fermer la lecture audio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/** Aucune voix pour la langue : explication et accès aux réglages du téléphone */
const NoVoiceNotice: React.FC<{ lang: AudioLang; inline?: boolean }> = ({ lang, inline }) => {
  const label = AUDIO_LANGUAGES[lang].label.toLocaleLowerCase('fr');
  const steps = isAndroid()
    ? 'Réglages › Accessibilité › Synthèse vocale › moteur Google › Installer les données vocales.'
    : isIOS()
      ? 'Réglages › Accessibilité › Contenu énoncé › Voix.'
      : 'Paramètres du système › Heure et langue › Voix (ou Langue), puis ajoutez une voix.';
  return (
    <div className={inline
      ? 'rounded-md bg-amber-500/10 p-2 text-[12px] leading-snug'
      : 'px-[10px] py-1.5 bg-amber-950/70 text-[12px] leading-snug'}
    >
      <div className="flex items-start gap-2 max-w-6xl mx-auto">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
        <div className="flex-1">
          <b>Aucune voix {label === 'english' ? 'anglaise' : 'française'} n'est installée sur cet appareil.</b>{' '}
          Téléchargez-en une : {steps}
          {isAndroid() && (
            <a href={ANDROID_TTS_SETTINGS_URL} className="ml-1 inline-flex items-center gap-1 font-bold underline">
              Ouvrir les réglages <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
