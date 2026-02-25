import { ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfidenceRibbonProps {
  /** Snapshot coverage percentage (0–100) */
  coveragePercent?: number | null;
  /** Number of data quality issues */
  issuesCount?: number | null;
  /** Timestamp string or Date for "As of" display */
  asOf?: string | Date | null;
  /** Compact mode for smaller placements */
  compact?: boolean;
  className?: string;
}

function getConfidenceLevel(coveragePercent: number | null | undefined, issuesCount: number | null | undefined) {
  if (coveragePercent == null) return { label: '—', color: 'text-muted-foreground' };
  if (coveragePercent >= 80 && (issuesCount == null || issuesCount <= 2)) {
    return { label: 'High', color: 'text-primary' };
  }
  if (coveragePercent >= 50 && (issuesCount == null || issuesCount <= 5)) {
    return { label: 'Medium', color: 'text-accent-foreground' };
  }
  return { label: 'Low', color: 'text-destructive' };
}

function formatAsOf(asOf: string | Date | null | undefined): string | null {
  if (!asOf) return null;
  try {
    const d = typeof asOf === 'string' ? new Date(asOf) : asOf;
    if (isNaN(d.getTime())) return String(asOf);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(asOf);
  }
}

export function ConfidenceRibbon({ coveragePercent, issuesCount, asOf, compact, className }: ConfidenceRibbonProps) {
  const level = getConfidenceLevel(coveragePercent, issuesCount);
  const formattedTime = formatAsOf(asOf);

  return (
    <div
      className={cn(
        'flex items-center gap-3 flex-wrap text-xs text-muted-foreground',
        compact ? 'gap-2' : 'gap-3',
        className,
      )}
    >
      {/* Confidence level */}
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className={cn('h-3.5 w-3.5', level.color)} />
        <span className="font-medium">Confidence:</span>
        <span className={cn('font-semibold', level.color)}>{level.label}</span>
      </span>

      {/* As of */}
      {formattedTime && (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>As of {formattedTime}</span>
        </span>
      )}

      {/* Issues count */}
      {issuesCount != null && issuesCount > 0 && (
        <span className="inline-flex items-center gap-1 text-destructive/80">
          <AlertTriangle className="h-3 w-3" />
          <span>{issuesCount} data issue{issuesCount !== 1 ? 's' : ''}</span>
        </span>
      )}
    </div>
  );
}
