import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Shield, Award, Crown, Gem } from 'lucide-react';
import type { CertificationTier } from '@/hooks/useCertificationTier';

interface CertificationBadgeProps {
  tier: CertificationTier;
  compact?: boolean;
  className?: string;
  reasons?: string[];
}

const tierConfig: Record<CertificationTier, {
  label: string;
  icon: typeof Shield;
  badgeClass: string;
  iconClass: string;
  description: string;
}> = {
  none: {
    label: 'Uncertified',
    icon: Shield,
    badgeClass: 'bg-muted text-muted-foreground border-border',
    iconClass: 'text-muted-foreground',
    description: 'Complete onboarding to earn certification',
  },
  bronze: {
    label: 'Bronze',
    icon: Shield,
    badgeClass: 'bg-[hsl(30_60%_92%)] text-[hsl(30_60%_30%)] border-[hsl(30_50%_70%)] dark:bg-[hsl(30_40%_20%)] dark:text-[hsl(30_60%_70%)] dark:border-[hsl(30_30%_35%)]',
    iconClass: 'text-[hsl(30_60%_45%)] dark:text-[hsl(30_60%_60%)]',
    description: 'Foundational controls established',
  },
  silver: {
    label: 'Silver',
    icon: Award,
    badgeClass: 'bg-[hsl(210_15%_92%)] text-[hsl(210_15%_35%)] border-[hsl(210_15%_70%)] dark:bg-[hsl(210_15%_18%)] dark:text-[hsl(210_15%_75%)] dark:border-[hsl(210_10%_30%)]',
    iconClass: 'text-[hsl(210_15%_50%)] dark:text-[hsl(210_15%_65%)]',
    description: 'Approval discipline verified',
  },
  gold: {
    label: 'Gold',
    icon: Crown,
    badgeClass: 'bg-[hsl(45_80%_90%)] text-[hsl(45_70%_28%)] border-[hsl(45_60%_65%)] dark:bg-[hsl(45_50%_18%)] dark:text-[hsl(45_70%_65%)] dark:border-[hsl(45_40%_30%)]',
    iconClass: 'text-[hsl(45_70%_45%)] dark:text-[hsl(45_70%_55%)]',
    description: 'Variance discipline & profit tracking active',
  },
  platinum: {
    label: 'Platinum',
    icon: Gem,
    badgeClass: 'bg-[hsl(260_50%_93%)] text-[hsl(260_50%_35%)] border-[hsl(260_40%_70%)] dark:bg-[hsl(260_30%_18%)] dark:text-[hsl(260_50%_75%)] dark:border-[hsl(260_25%_30%)]',
    iconClass: 'text-[hsl(260_50%_50%)] dark:text-[hsl(260_50%_65%)]',
    description: 'AI-optimized with automated risk controls',
  },
};

export const CertificationBadge = memo(function CertificationBadge({
  tier,
  compact = false,
  className,
  reasons = [],
}: CertificationBadgeProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  const badge = compact ? (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Icon className={cn('h-3.5 w-3.5', config.iconClass)} />
      <span className="text-xs font-semibold">{config.label}</span>
    </div>
  ) : (
    <Badge variant="outline" className={cn('gap-1.5 font-semibold', config.badgeClass, className)}>
      <Icon className={cn('h-3.5 w-3.5', config.iconClass)} />
      {config.label}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium text-xs mb-1">
          Operational Certification — {config.label}
        </p>
        <p className="text-xs text-muted-foreground mb-1">{config.description}</p>
        {reasons.length > 0 && (
          <ul className="text-xs space-y-0.5">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-muted-foreground">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
