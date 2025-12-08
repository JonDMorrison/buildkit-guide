import { useState, KeyboardEvent } from 'react';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => Promise<string | null>;
  disabled?: boolean;
}

export const ChatInputBar = ({
  onSend,
  isLoading,
  isRecording,
  isTranscribing,
  onStartRecording,
  onStopRecording,
  disabled,
}: ChatInputBarProps) => {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !isLoading) {
      onSend(trimmed);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      const text = await onStopRecording();
      if (text) {
        setInputValue(prev => (prev ? `${prev} ${text}` : text));
      }
    } else {
      onStartRecording();
    }
  };

  const isBusy = isLoading || isTranscribing;

  return (
    <div className="border-t border-border bg-background p-3">
      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 mb-2 text-xs text-destructive animate-pulse">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Recording... tap mic to stop
        </div>
      )}
      
      {isTranscribing && (
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Transcribing...
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Mic button */}
        <Button
          variant={isRecording ? 'destructive' : 'ghost'}
          size="icon"
          className={cn('h-9 w-9 flex-shrink-0', isRecording && 'animate-pulse')}
          onClick={handleMicClick}
          disabled={isBusy || disabled}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        {/* Text input */}
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
          rows={1}
          disabled={isBusy || disabled}
        />

        {/* Send button */}
        <Button
          variant="default"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={handleSend}
          disabled={!inputValue.trim() || isBusy || disabled}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
