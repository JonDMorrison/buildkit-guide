import { useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SetupPhaseSectionProps {
  phaseNumber: number;
  phaseName: string;
  completedSteps: number;
  totalSteps: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SetupPhaseSection({
  phaseNumber,
  phaseName,
  completedSteps,
  totalSteps,
  children,
  defaultOpen = false,
}: SetupPhaseSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isComplete = completedSteps === totalSteps;
  const progressPercent = (completedSteps / totalSteps) * 100;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border last:border-b-0">
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
          {/* Phase Number Badge */}
          <div
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
              isComplete
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isComplete ? <Check className="w-4 h-4" /> : phaseNumber}
          </div>

          {/* Phase Name & Progress */}
          <div className="flex-1 text-left">
            <div className="flex items-center justify-between">
              <span className={cn(
                'font-medium',
                isComplete && 'text-muted-foreground'
              )}>
                {phaseName}
              </span>
              <span className="text-sm text-muted-foreground">
                {completedSteps}/{totalSteps}
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5 mt-1.5" />
          </div>

          {/* Expand/Collapse Icon */}
          <div className="flex-shrink-0 text-muted-foreground">
            {isOpen ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
