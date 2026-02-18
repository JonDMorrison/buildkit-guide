import { memo } from 'react';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from '@/lib/utils';
import type { IntegrityStatus } from '@/hooks/useProjectIntegrity';

interface IntegrityBadgeProps {
  status: IntegrityStatus;
  score: number;
  blockers: string[];
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<IntegrityStatus, { label: string; dotClass: string; badgeClass: string }> = {
  clean: {
    label: 'Clean',
    dotClass: 'bg-status-complete',
    badgeClass: 'bg-status-complete/10 text-status-complete border-status-complete/20',
  },
  needs_attention: {
    label: 'Needs Attention',
    dotClass: 'bg-accent',
    badgeClass: 'bg-accent/10 text-accent border-accent/20',
  },
  blocked: {
    label: 'Blocked',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export const IntegrityBadge = memo(function IntegrityBadge({
  status,
  score,
  blockers,
  compact = false,
  className,
}: IntegrityBadgeProps) {
  const config = statusConfig[status];

  const badge = compact ? (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', config.dotClass)} />
      <span className="text-xs font-medium text-muted-foreground">{score}</span>
    </div>
  ) : (
    <Badge variant="outline" className={cn('gap-1.5', config.badgeClass, className)}>
      <span className={cn('inline-block w-2 h-2 rounded-full', config.dotClass)} />
      {config.label}
    </Badge>
  );

  if (blockers.length === 0) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium text-xs mb-1">Financial Integrity — {score}/100</p>
        <ul className="text-xs space-y-0.5">
          {blockers.map((b, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-muted-foreground">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
});
