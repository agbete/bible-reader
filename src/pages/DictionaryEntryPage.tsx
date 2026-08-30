import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/bible/Navbar';
import { 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Book,
  BookMarked,
  Share2,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showSuccess } from '@/utils/toast';
import { getDictionaryEntryById, DictionaryEntryDetail } from '@/services/dictionaryDb';

const DictionaryEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const { dictionaryId, entryId } = useParams<{ dictionaryId: string; entryId: string }>();

  const [entry, setEntry] = useState<DictionaryEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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
        }
      } catch (err) {
        console.error('Error loading entry:', err);
        setError('Erreur lors du chargement de l\'entrée');
      } finally {
        setLoading(false);
      }
    };

    loadEntry();
  }, [dictionaryId, entryId]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    showSuccess("Lien copié dans le presse-papier !");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar currentVersion="LSG" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto mb-4" />
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
          <div className="text-center max-w-md mx-auto px-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">{error || 'Entrée non trouvée'}</h1>
            <p className="text-muted-foreground mb-6">
              L'entrée que vous recherchez n'existe pas ou a été supprimée.
            </p>
            <Button onClick={() => navigate('/dictionnaire')} className="rounded-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dictionnaire
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar currentVersion="LSG" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dictionnaire')}
            className="h-9 px-3 rounded-full text-muted-foreground hover:text-foreground gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dictionnaire
          </Button>
        </div>

        {/* Entry Header */}
        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-amber-900 via-amber-950 to-stone-900 text-amber-50 border border-amber-800/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-xs text-amber-300/70 mb-3">
                <BookMarked className="w-3.5 h-3.5" />
                <span>{entry.dictionary_name}</span>
                {entry.author && (
                  <>
                    <span>—</span>
                    <span>{entry.author}</span>
                  </>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                {entry.entry_name}
              </h1>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 px-3 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs gap-1.5"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'Copié !' : 'Partager'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Entry Content */}
        <article className="prose prose-amber dark:prose-invert max-w-none mb-12">
          <div 
            className="text-sm sm:text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: entry.content }}
          />
        </article>

        {/* Navigation Footer */}
        <div className="border-t border-border pt-6">
          {/* Previous / Next Navigation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {entry.prev_entry ? (
              <Link
                to={`/dictionnaire/${dictionaryId}/${entry.prev_entry.id}`}
                className="group p-4 rounded-2xl border border-border bg-card hover:bg-amber-50/50 dark:hover:bg-amber-950/20 hover:border-amber-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Entrée précédente
                    </span>
                    <h4 className="font-semibold text-foreground group-hover:text-amber-600 transition-colors truncate">
                      {entry.prev_entry.entry_name}
                    </h4>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-border bg-muted/30 text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider">Entrée précédente</span>
                    <p className="text-sm">Première entrée</p>
                  </div>
                </div>
              </div>
            )}

            {entry.next_entry ? (
              <Link
                to={`/dictionnaire/${dictionaryId}/${entry.next_entry.id}`}
                className="group p-4 rounded-2xl border border-border bg-card hover:bg-amber-50/50 dark:hover:bg-amber-950/20 hover:border-amber-500/40 transition-all text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Entrée suivante
                    </span>
                    <h4 className="font-semibold text-foreground group-hover:text-amber-600 transition-colors truncate">
                      {entry.next_entry.entry_name}
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-border bg-muted/30 text-muted-foreground">
                <div className="flex items-center justify-end gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider">Entrée suivante</span>
                    <p className="text-sm">Dernière entrée</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Back to Dictionary */}
          <div className="text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/dictionnaire')}
              className="h-11 px-6 rounded-full bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 font-medium"
            >
              <Book className="w-4 h-4 mr-2" />
              Retour au dictionnaire
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/20 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
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