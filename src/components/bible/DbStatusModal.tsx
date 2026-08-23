import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldAlert, 
  Copy, 
  Check, 
  Code2 
} from 'lucide-react';
import { testSupabaseConnection, DbStatusReport } from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';

interface DbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DbStatusModal: React.FC<DbStatusModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<DbStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlHelper, setShowSqlHelper] = useState(false);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await testSupabaseConnection();
      setReport(res);
    } catch (e) {
      console.error('Erreur lors du test de connexion:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const totalRowsCount = report?.tables.reduce((acc, t) => acc + (t.count || 0), 0) || 0;
  const hasRlsErrors = report?.tables.some(t => t.status === 'rls_restricted' || t.status === 'error');

  const fixSql = `-- SQL pour accorder la lecture publique à toutes les tables bibliques :
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Activer les politiques RLS en lecture publique :
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Public read access" ON public.' || quote_ident(r.tablename) || ';';
        EXECUTE 'CREATE POLICY "Public read access" ON public.' || quote_ident(r.tablename) || ' FOR SELECT USING (true);';
    END LOOP;
END $$;`;

  const copySql = () => {
    navigator.clipboard.writeText(fixSql);
    setCopiedSql(true);
    showSuccess("Script SQL copié ! Collez-le dans l'éditeur SQL de votre tableau de bord Supabase.");
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6 rounded-3xl">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Diagnostic Base Supabase</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    report?.connected 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}>
                    {report?.connected ? 'Connecté' : 'Erreur de connexion'}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Projet: <span className="font-mono font-medium">lkqutlnqiojtitofiqer</span> • Vérifié à {report?.timestamp || '--:--'}
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={checkConnection}
              disabled={loading}
              className="h-8 px-2.5 rounded-full text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Tester</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Status Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Summary Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <span className="text-[11px] text-muted-foreground block">Tables vérifiées</span>
              <span className="text-lg font-bold text-foreground">{report?.tables.length || 0} tables</span>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <span className="text-[11px] text-muted-foreground block">Lignes accessibles</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{totalRowsCount.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border col-span-2 sm:col-span-1">
              <span className="text-[11px] text-muted-foreground block">Versions détectées</span>
              <span className="text-lg font-bold text-foreground">{report?.versions.length || 0}</span>
            </div>
          </div>

          {/* RLS or Permission Notice if tables are blocked */}
          {hasRlsErrors && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2 text-amber-800 dark:text-amber-200 font-bold">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Accès restreint par RLS / Grants</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSqlHelper(!showSqlHelper)}
                  className="h-7 text-[11px] gap-1 rounded-lg"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showSqlHelper ? 'Masquer SQL' : 'Afficher script SQL'}</span>
                </Button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Vos tables sont présentes mais Supabase bloque la lecture par l'application car les permissions `GRANT SELECT` ou les policies RLS ne sont pas encore accordées au rôle public.
              </p>

              {showSqlHelper && (
                <div className="mt-2 pt-2 border-t border-amber-300/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-[11px]">Exécutez ce script dans votre SQL Editor Supabase :</span>
                    <Button size="sm" onClick={copySql} className="h-7 text-xs gap-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white">
                      {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql ? 'Copié !' : 'Copier SQL'}</span>
                    </Button>
                  </div>
                  <pre className="p-2.5 rounded-xl bg-background/80 border border-border font-mono text-[10px] overflow-x-auto text-foreground">
                    {fixSql}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Table by Table inspection */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Détail par table dans Supabase
            </span>

            <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card">
              {report?.tables.map((t) => (
                <div key={t.name} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {t.status === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : t.status === 'empty' ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : t.status === 'rls_restricted' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <div>
                      <span className="font-mono font-semibold">{t.name}</span>
                      {t.error && (
                        <p className="text-[10px] text-rose-500 dark:text-rose-400 truncate max-w-xs sm:max-w-sm">
                          {t.error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {t.count !== null ? (
                      <span className="font-semibold text-foreground">
                        {t.count.toLocaleString()} ligne{t.count > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                        {t.status === 'rls_restricted' ? 'RLS à autoriser' : 'Erreur'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Versions list */}
          {report?.versions && report.versions.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/<dyad-write path="src/components/bible/DbStatusModal.tsx" description="Finalisation et correction complète du composant DbStatusModal">
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldAlert, 
  Copy, 
  Check, 
  Code2 
} from 'lucide-react';
import { testSupabaseConnection, DbStatusReport } from '@/services/bibleDb';
import { showSuccess } from '@/utils/toast';

interface DbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DbStatusModal: React.FC<DbStatusModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<DbStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlHelper, setShowSqlHelper] = useState(false);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await testSupabaseConnection();
      setReport(res);
    } catch (e) {
      console.error('Erreur lors du test de connexion:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const totalRowsCount = report?.tables.reduce((acc, t) => acc + (t.count || 0), 0) || 0;
  const hasRlsErrors = report?.tables.some(t => t.status === 'rls_restricted' || t.status === 'error');

  const fixSql = `-- SQL pour accorder la lecture publique à toutes les tables bibliques :
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Activer les politiques RLS en lecture publique :
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Public read access" ON public.' || quote_ident(r.tablename) || ';';
        EXECUTE 'CREATE POLICY "Public read access" ON public.' || quote_ident(r.tablename) || ' FOR SELECT USING (true);';
    END LOOP;
END $$;`;

  const copySql = () => {
    navigator.clipboard.writeText(fixSql);
    setCopiedSql(true);
    showSuccess("Script SQL copié ! Collez-le dans l'éditeur SQL de votre tableau de bord Supabase.");
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-6 rounded-3xl">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Diagnostic Base Supabase</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    report?.connected 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}>
                    {report?.connected ? 'Connecté' : 'Erreur de connexion'}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Projet: <span className="font-mono font-medium">lkqutlnqiojtitofiqer</span> • Vérifié à {report?.timestamp || '--:--'}
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={checkConnection}
              disabled={loading}
              className="h-8 px-2.5 rounded-full text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Tester</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Status Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Summary Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <span className="text-[11px] text-muted-foreground block">Tables vérifiées</span>
              <span className="text-lg font-bold text-foreground">{report?.tables.length || 0} tables</span>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <span className="text-[11px] text-muted-foreground block">Lignes accessibles</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{totalRowsCount.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border col-span-2 sm:col-span-1">
              <span className="text-[11px] text-muted-foreground block">Versions détectées</span>
              <span className="text-lg font-bold text-foreground">{report?.versions.length || 0}</span>
            </div>
          </div>

          {/* RLS or Permission Notice if tables are blocked */}
          {hasRlsErrors && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2 text-amber-800 dark:text-amber-200 font-bold">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Accès restreint par RLS / Grants</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSqlHelper(!showSqlHelper)}
                  className="h-7 text-[11px] gap-1 rounded-lg"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showSqlHelper ? 'Masquer SQL' : 'Afficher script SQL'}</span>
                </Button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Vos tables sont présentes mais Supabase bloque la lecture par l'application car les permissions `GRANT SELECT` ou les policies RLS ne sont pas encore accordées au rôle public.
              </p>

              {showSqlHelper && (
                <div className="mt-2 pt-2 border-t border-amber-300/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-[11px]">Exécutez ce script dans votre SQL Editor Supabase :</span>
                    <Button size="sm" onClick={copySql} className="h-7 text-xs gap-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white">
                      {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql ? 'Copié !' : 'Copier SQL'}</span>
                    </Button>
                  </div>
                  <pre className="p-2.5 rounded-xl bg-background/80 border border-border font-mono text-[10px] overflow-x-auto text-foreground">
                    {fixSql}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Table by Table inspection */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Détail par table dans Supabase
            </span>

            <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card">
              {report?.tables.map((t) => (
                <div key={t.name} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {t.status === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : t.status === 'empty' ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : t.status === 'rls_restricted' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <div>
                      <span className="font-mono font-semibold">{t.name}</span>
                      {t.error && (
                        <p className="text-[10px] text-rose-500 dark:text-rose-400 truncate max-w-xs sm:max-w-sm">
                          {t.error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {t.count !== null ? (
                      <span className="font-semibold text-foreground">
                        {t.count.toLocaleString()} ligne{t.count > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                        {t.status === 'rls_restricted' ? 'RLS à autoriser' : 'Erreur'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Versions list */}
          {report?.versions && report.versions.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/60 text-xs">
              <span className="font-semibold text-amber-900 dark:text-amber-300 block mb-1">
                Versions bibliques actives dans la base :
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {report.versions.map((v) => (
                  <span
                    key={v.code}
                    className="px-2 py-0.5 rounded-full bg-white dark:bg-stone-900 border border-amber-300/40 text-amber-800 dark:text-amber-200 text-[11px] font-mono"
                  >
                    {v.code} — {v.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-end">
          <Button size="sm" onClick={onClose} className="rounded-full text-xs px-4">
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};