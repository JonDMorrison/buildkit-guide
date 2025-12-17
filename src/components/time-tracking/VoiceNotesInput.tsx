import { useState } from 'react';
import { Mic, MicOff, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { cn } from '@/lib/utils';

interface VoiceNotesInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function VoiceNotesInput({
  value,
  onChange,
  placeholder = "Add notes (optional)...",
  className,
}: VoiceNotesInputProps) {
  const [showInput, setShowInput] = useState(false);
  
  const { isRecording, isTranscribing, startRecording, stopRecording, cancelRecording } = useVoiceInput({
    onTranscription: (text) => {
      onChange(value ? `${value} ${text}` : text);
      setShowInput(true);
    },
  });

  const handleMicClick = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleClear = () => {
    onChange('');
    if (isRecording) {
      cancelRecording();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          size="sm"
          onClick={handleMicClick}
          disabled={isTranscribing}
          className={cn(
            "transition-all",
            isRecording && "animate-pulse"
          )}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Transcribing...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="h-4 w-4 mr-1.5" />
              Stop
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-1.5" />
              Voice Note
            </>
          )}
        </Button>

        {!showInput && !value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowInput(true)}
            className="text-muted-foreground"
          >
            or type
          </Button>
        )}

        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-destructive animate-fade-in">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
          </span>
          Recording... tap Stop when done
        </div>
      )}

      {/* Text input (shown if user typed or transcribed) */}
      {(showInput || value) && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="resize-none text-sm animate-fade-in"
        />
      )}
    </div>
  );
}
