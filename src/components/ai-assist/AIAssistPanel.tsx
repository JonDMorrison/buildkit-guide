import { useEffect, useRef } from 'react';
import { 
  X, Sparkles, AlertTriangle, 
  Shield, Loader2, ClipboardList, CalendarDays, Trash2
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiAssist } from '@/hooks/useAiAssist';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useProjectRole } from '@/hooks/useProjectRole';
import { cn } from '@/lib/utils';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatInputBar } from './ChatInputBar';
import TypingIndicator from './TypingIndicator';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { getRoleForProject, isGlobalAdmin } = useProjectRole(projectId || undefined);
  const userRole = projectId ? getRoleForProject(projectId) : null;
  const displayRole = isGlobalAdmin ? 'Admin' : userRole?.replace('_', ' ') || 'Member';
  
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  } = useAiAssist(projectId);

  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
  } = useVoiceInput();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      // Scroll the parent (ScrollArea viewport) to show the bottom of the content
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  const handleQuickAction = async (prompt: string) => {
    if (isLoading || !projectId) return;
    await sendMessage(prompt);
  };

  const handleSendMessage = async (message: string) => {
    if (!projectId) return;
    await sendMessage(message);
  };

  const handleClose = () => {
    onClose();
  };

  const handleClearChat = () => {
    clearMessages();
  };

  const hasMessages = messages.length > 0;

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
                  Ask anything about your project
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Clear conversation"
                  disabled={!hasMessages}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
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

        {/* Chat Area */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4" ref={scrollRef}>
            {/* Empty state with quick actions */}
            {!hasMessages && !isLoading && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-medium text-foreground mb-1">How can I help?</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask me anything about your project or try a quick action below.
                  </p>
                </div>
                
                <div className="grid gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto py-3 px-4 justify-start text-left hover:bg-muted/50"
                      onClick={() => handleQuickAction(action.prompt)}
                    >
                      <div className={cn("mr-3", action.color)}>
                        <action.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm">{action.label}</span>
                    </Button>
                  ))}
                </div>

                {!projectId && (
                  <p className="text-xs text-muted-foreground text-center">
                    Select a project to use AI Assist
                  </p>
                )}
              </div>
            )}

            {/* Chat messages */}
            {hasMessages && (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    actions={message.actions}
                  />
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && <TypingIndicator />}
          </div>
        </ScrollArea>

        {/* Input bar */}
        <ChatInputBar
          onSend={handleSendMessage}
          isLoading={isLoading}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          disabled={!projectId}
        />

        {/* Footer hint */}
        <div className="px-3 pb-3 pt-1 flex-shrink-0">
          <p className="text-[10px] text-muted-foreground text-center">
            Press Cmd+I to toggle • Voice input supported
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
