import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Compass, 
  ArrowRight,
  BookOpenCheck,
  Calendar
} from 'lucide-react';
import { DAILY_READING_PLANS, ReadingPlanItem } from '@/data/bibleData';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';

interface ReadingPlansProps {
  onSelectPassage: (bookId: string, chapter: number) => void;
}

export const ReadingPlans: React.FC<ReadingPlansProps> = ({ onSelectPassage }) => {
  const [plans, setPlans] = useState<ReadingPlanItem[]>(DAILY_READING_PLANS);

  const completedCount = plans.filter(p => p.completed).length;
  const progressPercent = Math.round((completedCount / plans.length) * 100);

  const toggleComplete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPlans(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextState = !p.completed;
          if (nextState) {
            showSuccess(`Bravo ! Passage « ${p.passage} » marqué comme lu.`);
          }
          return { ...p, completed: nextState };
        }
        return p;
      })
    );
  };

  return (
    <section className="space-y-4">
      {/* Header and Progress Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
        <div>
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider">
            <Compass className="w-4 h-4" />
            <span>Plan de Lecture Quotidien</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mt-0.5">
            Votre parcours d'aujourd'hui
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nourrissez votre foi avec une sélection équilibrée de l'Ancien, du Nouveau Testament et des Psaumes.
          </p>
        </div>

        <div className="flex items-center gap-4 sm:border-l sm:border-border/60 sm:pl-5">
          <div className="text-right">
            <span className="text-xs text-muted-foreground block font-medium">Progression du jour</span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {completedCount} / {plans.length} chapitres ({progressPercent}%)
            </span>
          </div>
          <div className="w-14 h-14 relative flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-muted/40"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-amber-500 transition-all duration-500 ease-out"
                strokeDasharray={`${progressPercent}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <BookOpenCheck className="w-5 h-5 absolute text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </div>

      {/* Plans List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => onSelectPassage(plan.bookId, plan.chapter)}
            className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              plan.completed 
                ? 'bg-muted/30 border-border opacity-80' 
                : 'bg-card border-border hover:border-amber-500/50 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <button
                onClick={(e) => toggleComplete(e, plan.id)}
                className="text-muted-foreground hover:text-amber-600 transition-colors shrink-0"
                title={plan.completed ? 'Marquer comme non lu' : 'Marquer comme lu'}
              >
                {plan.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-500/20" />
                ) : (
                  <Circle className="w-6 h-6 hover:text-amber-500" />
                )}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${plan.completed ? 'line-through text-muted-foreground' : 'text-foreground group-hover:text-amber-600 transition-colors'}`}>
                    {plan.passage}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                    {plan.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {plan.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{plan.estimatedMinutes} min</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};