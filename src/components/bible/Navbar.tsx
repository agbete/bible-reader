import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  BookOpen, 
  Search, 
  Bookmark, 
  Flame, 
  Sun, 
  Moon, 
  ChevronDown,
  Database,
  BookMarked,
  BookText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BIBLE_VERSIONS } from '@/data/bibleData';
import { testSupabaseConnection } from '@/services/bibleDb';

interface NavbarProps {
  currentVersion?: string;
  onVersionChange?: (code: string) => void;
  onOpenSearch?: () => void;
  onOpenBookmarks?: () => void;
  onOpenDbStatus?: () => void;
  streakCount?: number;
  onQuickExplore?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentVersion = 'LSG',
  onVersionChange,
  onOpenSearch,
  onOpenBookmarks,
  onOpenDbStatus,
  streakCount = 7,
  onQuickExplore
}) => {
  const [isDark, setIsDark] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    testSupabaseConnection().then(res => {
      setDbConnected(res.connected);
    }).catch(() => setDbConnected(false));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  const selectedVersionObj = BIBLE_VERSIONS.find(v => v.code === currentVersion) || BIBLE_VERSIONS[0];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#92400E] dark:bg-[#1C1917] text-white transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[40px] flex items-center justify-between gap-2">
        {/* Brand logo & name */}
        <Link to="/" className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center shadow-md shadow-black/20 text-white font-bold shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white dark:text-amber-200">
                Parole Vivante
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-amber-950 text-white dark:text-amber-300">
                Bible
              </span>
            </div>
            {/* <p className="text-[11px] text-muted-foreground hidden sm:block">
              Méditation, lecture & étude biblique
            </p> */}
          </div>
        </Link>

        {/* Center: Navigation Links & Search input */}
        <div className="flex items-center gap-2 flex-1 max-w-lg mx-3 sm:mx-6">
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                location.pathname === '/'
                  ? 'bg-white/20 text-white font-bold'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Accueil
            </Link>

            {/* Onglet BIBLE */}
            <Link
              to="/bible"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                location.pathname.startsWith('/bible')
                  ? 'bg-white/20 text-white font-bold'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Bible</span>
            </Link>

            {/* Onglet DICTIONNAIRE */}
            <Link
              to="/dictionnaire"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                location.pathname.startsWith('/dictionnaire')
                  ? 'bg-white/20 text-white font-bold'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <BookText className="w-3.5 h-3.5" />
              <span>Dictionnaire</span>
            </Link>
          </nav>

          {/* Search bar */}
          {/* <div className="flex-1 hidden md:block">
            <button
              onClick={onOpenSearch ? onOpenSearch : () => navigate('/bible')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-full border border-border bg-muted/40 hover:bg-muted/70 text-muted-foreground text-xs transition-all shadow-xs group"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-amber-600 group-hover:text-amber-500 transition-colors shrink-0" />
                <span className="truncate">Rechercher un verset, un livre...</span>
              </div>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div> */}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Mobile search button */}
          {onOpenSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSearch}
              className="md:hidden rounded-full w-9 h-9 text-white/80 hover:text-white hover:bg-white/10"
            >
              <Search className="w-4 h-4" />
            </Button>
          )}

          {/* Bookmarks toggle */}
          {onOpenBookmarks && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenBookmarks}
              className="rounded-full w-9 h-9 text-white/80 hover:text-white hover:bg-white/10"
              title="Mes versets favoris"
            >
              <Bookmark className="w-4 h-4" />
            </Button>
          )}

          {/* Dark mode switch */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full w-9 h-9 text-white/80 hover:text-white hover:bg-white/10"
            title="Changer de thème"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
};