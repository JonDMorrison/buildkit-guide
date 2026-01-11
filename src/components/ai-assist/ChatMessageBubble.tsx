import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { ActionSuggestion } from '@/hooks/useAiAssist';

interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionSuggestion[];
}

export const ChatMessageBubble = ({ role, content, actions }: ChatMessageBubbleProps) => {
  const navigate = useNavigate();
  const isUser = role === 'user';

  const handleAction = (action: ActionSuggestion) => {
    if (action.type === 'navigate' && action.route) {
      navigate(action.route);
    } else if (action.type === 'prefill' && action.prefillData) {
      // Prefill actions: store data in sessionStorage for the target form to pick up
      sessionStorage.setItem('ai_prefill_data', JSON.stringify(action.prefillData));
      if (action.route) {
        navigate(action.route);
      }
    }
  };

  // All actions with valid routes are now implemented
  const implementedActions = actions?.filter(action => {
    return action.route && (action.type === 'navigate' || action.type === 'prefill');
  });

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

        {/* Action chips for AI messages - only show implemented actions */}
        {!isUser && implementedActions && implementedActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {implementedActions.map((action, idx) => (
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