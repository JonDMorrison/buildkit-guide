import { Progress } from '@/components/ui/progress';
import { SectionHelp } from '@/components/dashboard/shared/SectionHelp';
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';

interface ProgressStripProps {
  completion: number;
  totalTasks: number;
  blockedTasks: number;
  safetyCompliance: number;
}

export function ProgressStrip({ completion, totalTasks, blockedTasks, safetyCompliance }: ProgressStripProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tabular-nums">{completion}%</span>
        </div>
        <Progress value={completion} className="flex-1 h-2" />
      </div>

      {/* Stat chips */}
      <div className="flex items-center gap-4 shrink-0 text-sm text-muted-foreground">
        <span className="tabular-nums">{totalTasks} tasks</span>

        <span className={`flex items-center gap-1 tabular-nums ${blockedTasks > 0 ? 'text-destructive font-medium' : ''}`}>
          {blockedTasks > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
          {blockedTasks} blocked
        </span>

        <span className="flex items-center gap-1 tabular-nums">
          <Shield className="h-3.5 w-3.5" />
          Safety: {safetyCompliance}%
        </span>

        <SectionHelp text="Quick project health summary — overall task completion, blocked tasks needing attention, and safety form compliance for the past week." />
      </div>
    </div>
  );
}
