import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  onTranscription: (text: string) => void;
  className?: string;
  disabled?: boolean;
}

export const VoiceInputButton = ({
  onTranscription,
  className,
  disabled = false,
}: VoiceInputButtonProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleClick = useCallback(async () => {
    // Check for Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Voice input is not supported in this browser. Try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    if (isRecording) {
      // Stop recording is handled by the recognition events
      return;
    }

    setIsRecording(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-CA";

    recognition.onresult = (event: any) => {
      setIsProcessing(true);
      const transcript = event.results[0][0].transcript;
      onTranscription(transcript);
      setIsProcessing(false);
      setIsRecording(false);
      toast({
        title: "Voice captured",
        description: "Text added to the field",
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      setIsProcessing(false);
      
      let message = "Could not capture voice";
      if (event.error === "no-speech") {
        message = "No speech detected. Try again.";
      } else if (event.error === "not-allowed") {
        message = "Microphone access denied. Please enable microphone access.";
      }
      
      toast({
        title: "Voice Error",
        description: message,
        variant: "destructive",
      });
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setIsRecording(false);
      toast({
        title: "Error",
        description: "Failed to start voice recording",
        variant: "destructive",
      });
    }
  }, [isRecording, onTranscription, toast]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={disabled || isProcessing}
      className={cn(
        "h-12 w-12 flex-shrink-0",
        isRecording && "bg-destructive/10 border-destructive text-destructive animate-pulse",
        className
      )}
      title={isRecording ? "Recording..." : "Voice input"}
    >
      {isProcessing ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-5 w-5" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
};
