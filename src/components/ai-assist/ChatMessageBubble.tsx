import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { ActionSuggestion } from '@/hooks/useAiAssist';
import { ConfirmationCard } from './ConfirmationCard';

interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionSuggestion[];
  onConfirmAction?: (confirmationId: string, entityType: string, entityData: Record<string, unknown>) => void;
}

export const ChatMessageBubble = ({ role, content, actions, onConfirmAction }: ChatMessageBubbleProps) => {
  const navigate = useNavigate();
  const isUser = role === 'user';
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleAction = (action: ActionSuggestion) => {
    if (action.type === 'navigate' && action.route) {
      navigate(action.route);
    } else if (action.type === 'prefill' && action.prefillData) {
      sessionStorage.setItem('ai_prefill_data', JSON.stringify(action.prefillData));
      if (action.route) {
        navigate(action.route);
      }
    }
  };

  const navActions = actions?.filter(a =>
    a.route && (a.type === 'navigate' || a.type === 'prefill')
  );

  const confirmActions = actions?.filter(a =>
    a.type === 'confirm' && a.confirmation_id && !dismissedIds.has(a.confirmation_id)
  );

  const handleDismiss = (confirmationId: string) => {
    setDismissedIds(prev => new Set(prev).add(confirmationId));
  };

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
        </div>
      )}

      <div className={cn('max-w-[85%] space-y-2', isUser && 'order-first')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-accent text-accent-foreground rounded-br-md'
              : 'bg-muted/50 text-foreground rounded-bl-md border border-border/50'
          )}
        >
          {isUser ? (
            <p>{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-headings:font-semibold">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Confirmation cards for create intents */}
        {!isUser && confirmActions && confirmActions.length > 0 && (
          <div className="space-y-2 pl-1">
            {confirmActions.map((action) => (
              <ConfirmationCard
                key={action.confirmation_id}
                action={action}
                onConfirm={onConfirmAction ?? (() => {})}
                onCancel={() => handleDismiss(action.confirmation_id!)}
              />
            ))}
          </div>
        )}

        {/* Navigation action chips */}
        {!isUser && navActions && navActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {navActions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full px-3 bg-background hover:bg-muted"
                onClick={() => handleAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
