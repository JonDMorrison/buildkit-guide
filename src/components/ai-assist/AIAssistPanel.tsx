import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Sparkles, AlertTriangle, 
  Clock, Shield, Receipt, FileText, Users, Loader2,
  ClipboardList, CalendarDays
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiAssist } from '@/hooks/useAiAssist';
import { useProjectRole } from '@/hooks/useProjectRole';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface AIAssistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName?: string;
}

const QUICK_ACTIONS = [
  { 
    id: 'blockers',
    label: 'What\'s blocking progress?', 
    icon: AlertTriangle,
    prompt: 'What is blocking progress right now? Give me a quick summary.',
    color: 'text-destructive'
  },
  { 
    id: 'this-week',
    label: 'This week\'s tasks', 
    icon: CalendarDays,
    prompt: 'Summarize tasks due this week. What should we focus on?',
    color: 'text-primary'
  },
  { 
    id: 'safety',
    label: 'Safety summary', 
    icon: Shield,
    prompt: 'Give me a safety summary for this project. Any recent incidents or concerns?',
    color: 'text-status-success'
  },
  { 
    id: 'daily-summary',
    label: 'Daily summary', 
    icon: ClipboardList,
    prompt: 'Give me a quick daily summary of project status, what got done, and what\'s next.',
    color: 'text-accent'
  },
];

export const AIAssistPanel = ({ isOpen, onClose, projectId, projectName }: AIAssistPanelProps) => {
  const navigate = useNavigate();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  
  const { getRoleForProject, isGlobalAdmin } = useProjectRole(projectId || undefined);
  const userRole = projectId ? getRoleForProject(projectId) : null;
  const displayRole = isGlobalAdmin ? 'Admin' : userRole?.replace('_', ' ') || 'Member';
  
  const {
    isLoading,
    sendMessage,
    clearMessages,
  } = useAiAssist(projectId);

  const handleActionClick = async (action: typeof QUICK_ACTIONS[0]) => {
    if (isLoading || !projectId) return;
    
    setActiveAction(action.id);
    setResult(null);
    
    // Send the message and get response
    const response = await sendMessage(action.prompt);
    if (response) {
      setResult(response);
    }
  };

  const handleClose = () => {
    setActiveAction(null);
    setResult(null);
    clearMessages();
    onClose();
  };

  const handleBack = () => {
    setActiveAction(null);
    setResult(null);
    clearMessages();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col h-full"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">AI Assist</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Quick insights for your project
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Context summary */}
          {projectName && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-normal">
                {projectName}
              </Badge>
              <Badge variant="secondary" className="font-normal capitalize">
                {displayRole}
              </Badge>
            </div>
          )}
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Show result if we have one */}
            {(activeAction || isLoading) ? (
              <div className="space-y-4">
                {/* Back button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBack}
                  disabled={isLoading}
                  className="text-muted-foreground -ml-2"
                >
                  ← Back to options
                </Button>

                {/* Loading state */}
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-accent" />
                      <p className="text-sm text-muted-foreground">Analyzing your project...</p>
                    </div>
                  </div>
                )}

                {/* Result */}
                {result && !isLoading && (
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:my-2">
                      <ReactMarkdown>{result}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Action buttons grid */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  What would you like to know?
                </p>
                
                <div className="grid gap-3">
                  {QUICK_ACTIONS.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto py-4 px-4 justify-start text-left hover:bg-muted/50"
                      onClick={() => handleActionClick(action)}
                      disabled={!projectId}
                    >
                      <div className={cn("mr-3", action.color)}>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{action.label}</span>
                    </Button>
                  ))}
                </div>

                {!projectId && (
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Select a project to use AI Assist
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="p-3 border-t border-border flex-shrink-0">
          <p className="text-[10px] text-muted-foreground text-center">
            Press Cmd+I to toggle AI Assist
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
