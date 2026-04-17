import { Check, Circle, Clock, HelpCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SetupChecklistItemProps {
  label: string;
  description: string;
  isComplete: boolean;
  timeEstimate?: string;
  helpText?: string;
  actionLabel?: string;
  onAction?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  isDisabled?: boolean;
}

export function SetupChecklistItem({
  label,
  description,
  isComplete,
  timeEstimate,
  helpText,
  actionLabel = 'Start',
  onAction,
  onSkip,
  skipLabel,
  isDisabled = false,
}: SetupChecklistItemProps) {
  const isClickable = !isComplete && !!onAction && !isDisabled;

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg transition-colors',
        isComplete ? 'bg-muted/30' : 'hover:bg-muted/50',
        isClickable && 'cursor-pointer',
        isDisabled && !isComplete && 'opacity-50'
      )}
      onClick={isClickable ? onAction : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAction!();
              }
            }
          : undefined
      }
    >
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isComplete ? (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium text-sm',
              isComplete ? 'text-muted-foreground line-through' : 'text-foreground'
            )}
          >
            {label}
          </span>

          {timeEstimate && !isComplete && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              <Clock className="w-3 h-3" />
              {timeEstimate}
            </span>
          )}

          {helpText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{helpText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <p className={cn(
          'text-xs mt-0.5',
          isComplete ? 'text-muted-foreground/70' : 'text-muted-foreground'
        )}>
          {description}
        </p>
      </div>

      {/* Action / skip affordances — pointer-events-none so clicks fall
          through to the row's onClick. The Button is purely visual. */}
      {!isComplete && onAction && (
        <div className="flex items-center gap-2 flex-shrink-0 pointer-events-none">
          <Button
            variant="ghost"
            size="sm"
            tabIndex={-1}
            disabled={isDisabled}
            className="flex-shrink-0"
          >
            {actionLabel}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Optional skip link — re-enables pointer events so it's its own click target */}
      {!isComplete && onSkip && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSkip();
          }}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 flex-shrink-0 pointer-events-auto mt-1"
        >
          {skipLabel || 'No thanks'}
        </button>
      )}
    </div>
  );
}
