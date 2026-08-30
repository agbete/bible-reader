import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/bible/Navbar';
import { 
  Search, 
  Book, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Loader2,
  BookOpen,
  BookMarked,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showSuccess } from '@/utils/toast';
import {
  getDictionaries,
  getDictionaryEntries,
  getAvailableLetters,
  Dictionary,
  DictionaryEntry,
} from '@/services/dictionaryDb';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const DictionaryPage: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);

  // Filter state
  const [selectedDictionary, setSelectedDictionary] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 100;

  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Load dictionaries on mount
  useEffect(() => {
    const loadDictionaries = async () => {
      try {
        const dicts = await getDictionaries();
        setDictionaries(dicts);
        
        // Select first dictionary by default
        if (dicts.length > 0 && !selectedDictionary) {
          setSelectedDictionary(dicts[0].id);
        }
      } catch (err) {
        console.error('Error loading dictionaries:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDictionaries();
  }, []);

  // Load entries when filters change
  const loadEntries = useCallback(async () => {
    if (!selectedDictionary) return;

    setLoadingEntries(true);
    try {
      const response = await getDictionaryEntries({
        dictionaryId: selectedDictionary,
        searchQuery: searchQuery,
        letter: selectedLetter || undefined,
        page: currentPage,
        pageSize
      });

      setEntries(response.entries);
      setTotalCount(response.totalCount);
      setTotalPages(response.totalPages);
    } catch (err) {
      console.error('Error loading entries:', err);
    } finally {
      setLoadingEntries(false);
    }
  }, [selectedDictionary, searchQuery, selectedLetter, currentPage]);

  // Load available letters when dictionary changes
  useEffect(() => {
    const loadLetters = async () => {
      if (!selectedDictionary) return;
      try {
        const letters = await getAvailableLetters(selectedDictionary);
        setAvailableLetters(letters);
      } catch (err) {
        console.error('Error loading letters:', err);
      }
    };

    loadLetters();
    setSelectedLetter(null); // Reset letter filter when dictionary changes
    setCurrentPage(1);
  }, [selectedDictionary]);

  // Load entries when filters change
  useEffect(() => {
    if (selectedDictionary) {
      loadEntries();
    }
  }, [selectedDictionary, searchQuery, selectedLetter, currentPage, loadEntries]);

  // Handle dictionary change
  const handleDictionaryChange = (dictId: string) => {
    setSelectedDictionary(parseInt(dictId, 10));
    setCurrentPage(1);
  };

  // Handle letter click
  const handleLetterClick = (letter: string) => {
    if (selectedLetter === letter) {
      setSelectedLetter(null);
    } else {
      setSelectedLetter(letter);
    }
    setCurrentPage(1);
  };

  // Handle entry click - navigate to detail page
  const handleEntryClick = (entry: DictionaryEntry) => {
    navigate(`/dictionnaire/${selectedDictionary}/${entry.id}`);
  };

  // Get current dictionary info
  const currentDictionary = dictionaries.find(d => d.id === selectedDictionary);

  // Reset search when letter changes
  useEffect(() => {
    if (selectedLetter) {
      setSearchQuery('');
    }
  }, [selectedLetter]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar currentVersion="LSG" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
              <Book className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Dictionnaire Biblique
              </h1>
              <p className="text-sm text-muted-foreground">
                Explorez les définitions et explications des termes bibliques
              </p>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mb-6 p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Dictionary Selector */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Dictionnaire
              </label>
              {loading ? (
                <div className="h-10 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">Chargement...</span>
                </div>
              ) : (
                <Select
                  value={selectedDictionary?.toString() || ''}
                  onValueChange={handleDictionaryChange}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Sélectionner un dictionnaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {dictionaries.map((dict) => (
                      <SelectItem key={dict.id} value={dict.id.toString()}>
                        <div className="flex items-center gap-2">
                          <BookMarked className="w-4 h-4 text-amber-600" />
                          <span>{dict.name}</span>
                          {dict.author && (
                            <span className="text-xs text-muted-foreground">
                              — {dict.author}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Search Input */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Recherche
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Rechercher un terme..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedLetter(null); // Reset letter when searching
                    setCurrentPage(1);
                  }}
                  className="h-10 pl-9 rounded-xl"
                  disabled={!selectedDictionary}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Alphabetical Filter */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filtrer par lettre
            </span>
            {selectedLetter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedLetter(null);
                  setCurrentPage(1);
                }}
                className="h-7 px-2 text-xs rounded-full text-muted-foreground hover:text-foreground"
              >
                Réinitialiser
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {ALPHABET.map((letter) => {
              const isAvailable = availableLetters.includes(letter);
              const isSelected = selectedLetter === letter;

              return (
                <button
                  key={letter}
                  onClick={() => isAvailable && handleLetterClick(letter)}
                  disabled={!isAvailable}
                  className={`
                    w-9 h-9 rounded-lg text-sm font-bold transition-all
                    ${isSelected
                      ? 'bg-amber-600 text-white shadow-md'
                      : isAvailable
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:scale-105'
                        : 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                    }
                  `}
                  title={isAvailable ? `Mots commençant par ${letter}` : `Aucun mot par ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Counter & Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {loadingEntries ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement...
              </span>
            ) : (
              <span>
                <strong className="text-foreground">{totalCount.toLocaleString()}</strong> entrée{totalCount > 1 ? 's' : ''} trouvée{totalCount > 1 ? 's' : ''}
                {selectedLetter && <span> — commençant par <strong className="text-amber-600">{selectedLetter}</strong></span>}
                {searchQuery && <span> — contenant « <strong className="text-foreground">{searchQuery}</strong> »</span>}
              </span>
            )}
          </div>

          {/* Page Navigation */}
          {!loadingEntries && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="sr-only">Précédent</span>
              </Button>

              <div className="flex items-center gap-1">
                {/* Show first page */}
                {currentPage > 3 && (
                  <>
                    <Button
                      variant={currentPage === 1 ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      className="h-8 w-8 p-0 rounded-full text-xs"
                    >
                      1
                    </Button>
                    {currentPage > 4 && <span className="px-1 text-muted-foreground">...</span>}
                  </>
                )}

                {/* Show pages around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - currentPage) <= 2)
                  .map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-8 w-8 p-0 rounded-full text-xs"
                    >
                      {page}
                    </Button>
                  ))}

                {/* Show last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-1 text-muted-foreground">...</span>}
                    <Button
                      variant={currentPage === totalPages ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="h-8 w-8 p-0 rounded-full text-xs"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
                <span className="sr-only">Suivant</span>
              </Button>
            </div>
          )}
        </div>

        {/* Entries List */}
        {loadingEntries ? (
          <div className="py-16 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-3" />
            <span className="text-sm font-medium">Chargement des entrées...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto opacity-40 mb-3" />
            <p className="text-sm font-semibold">
              {selectedDictionary
                ? 'Aucune entrée trouvée'
                : 'Sélectionnez un dictionnaire pour commencer'}
            </p>
            <p className="text-xs mt-1">
              {selectedDictionary
                ? 'Essayez de modifier vos critères de recherche'
                : 'Choisissez parmi les dictionnaires disponibles ci-dessus'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleEntryClick(entry)}
                className="w-full p-4 rounded-2xl border border-border bg-card hover:bg-amber-50/50 dark:hover:bg-amber-950/20 hover:border-amber-500/40 transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-amber-600 transition-colors line-clamp-1">
                      {entry.entry_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {entry.content.replace(/<[^>]*>/g, '').substring(0, 150)}
                      {entry.content.length > 150 ? '...' : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Bottom Pagination */}
        {!loadingEntries && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 px-4 rounded-full gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>

            <span className="text-sm text-muted-foreground px-4">
              Page {currentPage} sur {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 px-4 rounded-full gap-2"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/20 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-foreground">Dictionnaire Biblique</span>
          </div>
          <p className="text-center sm:text-right">
            Références: Westphal, Bost, Calmet, Lelievre
          </p>
        </div>
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default DictionaryPage;