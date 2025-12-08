import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Send, Sparkles, AlertTriangle, 
  Clock, Shield, Receipt, FileWarning, Users, Loader2,
  ChevronRight, Mic, Square
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiAssist, ChatMessage, ActionSuggestion, PressingIssues } from '@/hooks/useAiAssist';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface AIAssistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName?: string;
}

const SUGGESTED_PROMPTS = [
  { label: 'What is blocking progress?', icon: AlertTriangle },
  { label: 'Summarize tasks due this week', icon: Clock },
  { label: 'List safety incidents this week', icon: Shield },
  { label: 'Summarize receipts this week', icon: Receipt },
  { label: 'What does the GC list say we owe?', icon: FileWarning },
];

const FOREMAN_PROMPTS = [
  { label: 'What should my crew focus on first?', icon: Users },
  { label: 'Which tasks are blocked by other trades?', icon: AlertTriangle },
];

export const AIAssistPanel = ({ isOpen, onClose, projectId, projectName }: AIAssistPanelProps) => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { getRoleForProject, isGlobalAdmin } = useProjectRole(projectId || undefined);
  const userRole = projectId ? getRoleForProject(projectId) : null;
  const displayRole = isGlobalAdmin ? 'Admin' : userRole?.replace('_', ' ') || 'Member';
  
  const {
    messages,
    isLoading,
    pressingIssues,
    sendMessage,
    getInitialSummary,
    clearMessages,
  } = useAiAssist(projectId);

  // Voice input
  const { isRecording, isTranscribing, startRecording, stopRecording, cancelRecording } = useVoiceInput({
    onTranscription: (text) => {
      // Automatically send the transcribed message
      if (text && !isLoading) {
        sendMessage(text);
      }
    },
  });

  const handleVoiceToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  // Get initial summary when panel opens
  useEffect(() => {
    if (isOpen && projectId && messages.length === 0) {
      getInitialSummary();
    }
  }, [isOpen, projectId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleAction = (action: ActionSuggestion) => {
    if (action.type === 'navigate' && action.route) {
      // Append projectId if not present
      let route = action.route;
      if (projectId && !route.includes('projectId')) {
        const separator = route.includes('?') ? '&' : '?';
        route = `${route}${separator}projectId=${projectId}`;
      }
      navigate(route);
      onClose();
    }
  };

  const handleCloseAndClear = () => {
    onClose();
    // Don't clear messages immediately, keep them for context
  };

  const isForeman = userRole === 'foreman';
  const isWorker = userRole === 'internal_worker' || userRole === 'external_trade';
  const prompts = isForeman ? [...FOREMAN_PROMPTS, ...SUGGESTED_PROMPTS.slice(0, 3)] : SUGGESTED_PROMPTS;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleCloseAndClear()}>
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
                  Ask about this project or get suggested actions
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleCloseAndClear}>
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

        {/* Pressing Issues (if any) */}
        {pressingIssues && (pressingIssues.blocked_count > 0 || pressingIssues.overdue_count > 0 || pressingIssues.safety_incidents_count > 0) && (
          <div className="px-4 py-3 bg-accent/5 border-b border-border flex-shrink-0">
            <p className="text-xs font-medium text-foreground mb-2">Pressing Issues</p>
            <div className="flex flex-wrap gap-2">
              {pressingIssues.blocked_count > 0 && (
                <Badge 
                  variant="destructive" 
                  className="cursor-pointer"
                  onClick={() => handleAction({ label: '', type: 'navigate', route: '/tasks?status=blocked' })}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {pressingIssues.blocked_count} blocked
                </Badge>
              )}
              {pressingIssues.overdue_count > 0 && (
                <Badge 
                  variant="outline" 
                  className="border-status-issue text-status-issue cursor-pointer"
                  onClick={() => handleAction({ label: '', type: 'navigate', route: '/tasks' })}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {pressingIssues.overdue_count} overdue
                </Badge>
              )}
              {pressingIssues.due_today_count > 0 && (
                <Badge variant="outline" className="cursor-pointer">
                  <Clock className="h-3 w-3 mr-1" />
                  {pressingIssues.due_today_count} due today
                </Badge>
              )}
              {pressingIssues.safety_incidents_count > 0 && (
                <Badge 
                  variant="outline" 
                  className="border-destructive text-destructive cursor-pointer"
                  onClick={() => handleAction({ label: '', type: 'navigate', route: '/safety' })}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {pressingIssues.safety_incidents_count} incidents
                </Badge>
              )}
              {pressingIssues.pending_manpower_count > 0 && !isWorker && (
                <Badge 
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => handleAction({ label: '', type: 'navigate', route: '/manpower' })}
                >
                  <Users className="h-3 w-3 mr-1" />
                  {pressingIssues.pending_manpower_count} pending requests
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4">
            {/* Show prompts if no messages yet */}
            {messages.length === 0 && !isLoading && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {prompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-2 px-3"
                      onClick={() => handlePromptClick(prompt.label)}
                    >
                      <prompt.icon className="h-3 w-3 mr-1.5 text-muted-foreground" />
                      {prompt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                onAction={handleAction}
              />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick prompts after conversation started */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 py-2 border-t border-border flex-shrink-0 overflow-x-auto">
            <div className="flex gap-2">
              {prompts.slice(0, 3).map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="ghost"
                  size="sm"
                  className="text-xs whitespace-nowrap h-7 px-2"
                  onClick={() => handlePromptClick(prompt.label)}
                >
                  <prompt.icon className="h-3 w-3 mr-1" />
                  {prompt.label.split(' ').slice(0, 3).join(' ')}...
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0">
          {/* Voice recording indicator */}
          {(isRecording || isTranscribing) && (
            <div className="mb-3 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-accent/10 border border-accent/20">
              {isRecording && (
                <>
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm text-foreground">Recording... tap to stop</span>
                </>
              )}
              {isTranscribing && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  <span className="text-sm text-foreground">Transcribing...</span>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {/* Voice input button */}
            <Button
              onClick={handleVoiceToggle}
              disabled={isLoading || isTranscribing || !projectId}
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              className={cn(
                "flex-shrink-0 transition-all",
                isRecording && "animate-pulse"
              )}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>

            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening..." : "Ask or tap mic to speak..."}
              disabled={isLoading || isRecording || isTranscribing || !projectId}
              className="flex-1"
            />
            <Button 
              onClick={handleSend} 
              disabled={!inputValue.trim() || isLoading || isRecording || !projectId}
              size="icon"
              className="bg-accent hover:bg-accent/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Tap mic to speak • Enter to send • Cmd+I to toggle
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Message bubble component
const MessageBubble = ({ 
  message, 
  onAction 
}: { 
  message: ChatMessage; 
  onAction: (action: ActionSuggestion) => void;
}) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex flex-col gap-2",
      isUser ? "items-end" : "items-start"
    )}>
      <div className={cn(
        "max-w-[90%] rounded-lg px-3 py-2 text-sm",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted/50 text-foreground"
      )}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isUser && message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.actions.map((action, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => onAction(action)}
            >
              {action.label}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
