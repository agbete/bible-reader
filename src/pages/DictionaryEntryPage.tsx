import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/bible/Navbar';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Share2,
  Check,
  AlertCircle,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showSuccess } from '@/utils/toast';
import { getDictionaryEntryById, getDictionaryEntryIdsByNames, DictionaryEntryDetail } from '@/services/dictionaryDb';
import { extractDictionaryRefs, sanitizeDictionaryHtml } from '@/utils/dictionaryHtml';

const DictionaryEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const { dictionaryId, entryId } = useParams<{ dictionaryId: string; entryId: string }>();

  const [entry, setEntry] = useState<DictionaryEntryDetail | null>(null);
  const [resolvedRefs, setResolvedRefs] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadEntry = async () => {
    if (!dictionaryId || !entryId) {
      setError('Paramètres invalides');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const entryData = await getDictionaryEntryById(
        parseInt(entryId, 10),
        parseInt(dictionaryId, 10)
      );

      if (!entryData) {
        setError('Entrée non trouvée');
      } else {
        setEntry(entryData);
        window.scrollTo({ top: 0 });
        // Renvois : seuls ceux qui existent dans ce dictionnaire deviennent des liens
        const refs = extractDictionaryRefs(entryData.content);
        setResolvedRefs(refs.length ? await getDictionaryEntryIdsByNames(entryData.dictionary_id, refs) : new Map());
      }
    } catch (err) {
      console.error('Error loading entry:', err);
      setError('Erreur lors du chargement de l\'entrée');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntry();
  }, [dictionaryId, entryId]);

  const contentHtml = useMemo(
    () => (entry ? sanitizeDictionaryHtml(entry.content, resolvedRefs) : ''),
    [entry, resolvedRefs]
  );

  // Clic sur un renvoi interne
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('[data-entry-id]');
    if (link) {
      e.preventDefault();
      navigate(`/dictionnaire/${dictionaryId}/${link.dataset.entryId}`);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    showSuccess("Lien copié dans le presse-papier !");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !entry) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar currentVersion="LSG" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto" />
            <p className="text-muted-foreground">Chargement de l'entrée...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar currentVersion="LSG" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4 space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <h1 className="text-xl font-bold mb-2">{error || 'Entrée non trouvée'}</h1>
            <p className="text-muted-foreground mb-6">
              L'entrée que vous recherchez n'existe pas ou a été supprimée.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/dictionnaire')} className="rounded-full gap-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au dictionnaire
              </Button>
              <Button variant="outline" onClick={loadEntry} className="rounded-full gap-2">
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const neighbourLink = (target: { id: number; entry_name: string } | undefined, direction: 'prev' | 'next') => {
    const label = direction === 'prev' ? 'Entrée précédente' : 'Entrée suivante';
    if (!target) {
      return (
        <div className={`rounded-xl border border-dashed border-border px-4 py-3 text-muted-foreground ${direction === 'next' ? 'text-right' : ''}`}>
          <span className="block text-[11px] uppercase tracking-[0.15em]">{label}</span>
          <span className="font-cambria italic text-[15px]">{direction === 'prev' ? 'Première entrée' : 'Dernière entrée'}</span>
        </div>
      );
    }
    return (
      <Link
        to={`/dictionnaire/${dictionaryId}/${target.id}`}
        className={`group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-amber-400 hover:shadow-md transition-all ${
          direction === 'next' ? 'justify-end text-right' : ''
        }`}
      >
        {direction === 'prev' && <ChevronLeft className="w-5 h-5 shrink-0 text-amber-700 group-hover:-translate-x-0.5 transition-transform" />}
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
          <span className="block font-cambria text-[18px] font-bold truncate group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
            {target.entry_name}
          </span>
        </span>
        {direction === 'next' && <ChevronRight className="w-5 h-5 shrink-0 text-amber-700 group-hover:translate-x-0.5 transition-transform" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar currentVersion="LSG" />

      {/* En-tête de l'entrée */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#451A03] via-[#78350F] to-[#B45309] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#44403C] text-white">
        <span
          aria-hidden
          className="pointer-events-none select-none absolute right-2 sm:right-10 -bottom-20 font-cambria font-bold text-[16rem] leading-none text-white/[0.07]"
        >
          {entry.entry_name.charAt(0)}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-[10px] sm:px-8 pt-5 pb-7">
          <div className="flex items-center gap-2 text-[12px]">
            <Link to="/dictionnaire" className="flex items-center gap-1.5 text-amber-100/80 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Dictionnaire
            </Link>
            <span className="text-amber-200/50">/</span>
            <span className="text-amber-100/80 truncate">{entry.author || entry.dictionary_name}</span>

            <div className="ml-auto flex items-center gap-1">
              {entry.prev_entry && (
                <Link to={`/dictionnaire/${dictionaryId}/${entry.prev_entry.id}`} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title={entry.prev_entry.entry_name}>
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              )}
              {entry.next_entry && (
                <Link to={`/dictionnaire/${dictionaryId}/${entry.next_entry.id}`} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title={entry.next_entry.entry_name}>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-200/90">{entry.dictionary_name}</p>
          <h1 className="mt-1 font-cambria text-[36px] sm:text-[52px] font-bold leading-[1.1] drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
            {entry.entry_name}
          </h1>

          <button
            onClick={handleCopyLink}
            className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 text-[12px] font-semibold transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? 'Copié !' : 'Partager'}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-[10px] sm:px-8 py-8">
        {/* Contenu */}
        <article className={`rounded-2xl border border-border bg-card px-5 sm:px-10 py-7 shadow-sm transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <div
            className="dict-content font-cambria text-[17px] sm:text-[18px] leading-[1.75]"
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
          <div className="mt-8 pt-4 border-t border-border flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              {entry.dictionary_name}
            </span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="dict-legend-link">Renvoi</span></span>
              <span className="flex items-center gap-1"><span className="dict-legend-bible">Référence</span></span>
            </span>
          </div>
        </article>

        {/* Entrées voisines */}
        <nav className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {neighbourLink(entry.prev_entry, 'prev')}
          {neighbourLink(entry.next_entry, 'next')}
        </nav>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/20 py-8 mt-auto">
        <div className="w-full px-[10px] sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-foreground">Dictionnaire Biblique</span>
          </div>
          <p className="text-center sm:text-right">
            {entry.dictionary_name}
            {entry.author && ` — ${entry.author}`}
          </p>
        </div>
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default DictionaryEntryPage;
