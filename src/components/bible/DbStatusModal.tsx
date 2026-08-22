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
  Server, 
  ShieldAlert, 
  BookOpen, 
  Layers
} from 'lucide-react';
import { testSupabaseConnection, DbStatusReport } from '@/services/bibleDb';

interface DbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DbStatusModal: React.FC<DbStatusModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<DbStatusReport | null>(null);
  const [loading, setLoading] = useState(false);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await testSupabaseConnection();
      setReport(res);
    } catch (e) {
      console.error(e);
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
  const hasErrors = report?.tables.some(t => t.status === 'error' || t.status === 'rls_restricted');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-6 rounded-3xl">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Diagnostic Supabase</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    report?.connected 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}>
                    {report?.connected ? 'Connecté' : 'Non joignable'}
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
              <span className="text-lg font-bold text-foreground">{report?.tables.length || 0}</span>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <span className="text-[11px] text-muted-foreground block">Lignes comptées</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{totalRowsCount.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border col-span-2 sm:col-span-1">
              <span className="text-[11px] text-muted-foreground block">Versions détectées</span>
              <span className="text-lg font-bold text-foreground">{report?.versions.length || 0}</span>
            </div>
          </div>

          {/* Table by Table inspection */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              État par table
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
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t.status === 'rls_restricted' ? 'RLS Actif' : 'Erreur'}
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