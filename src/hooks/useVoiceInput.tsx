import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseVoiceInputOptions {
  onTranscription?: (text: string) => void;
  onError?: (error: string) => void;
}

export const useVoiceInput = (options?: UseVoiceInputOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMsg = error instanceof Error ? error.message : 'Microphone access denied';
      options?.onError?.(errorMsg);
      toast({
        title: 'Microphone Error',
        description: 'Please allow microphone access to use voice input.',
        variant: 'destructive',
      });
    }
  }, [options, toast]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    return new Promise<string | null>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        setIsRecording(false);

        // Combine chunks into blob
        const audioBlob = new Blob(chunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        
        // Check if we have any audio
        if (audioBlob.size < 1000) {
          toast({
            title: 'Recording too short',
            description: 'Please speak a bit longer and try again.',
            variant: 'destructive',
          });
          resolve(null);
          return;
        }

        setIsTranscribing(true);

        try {
          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          
          const base64Audio = await new Promise<string>((res, rej) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              res(base64);
            };
            reader.onerror = rej;
          });

          // Send to transcription function
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: { audio: base64Audio },
          });

          if (error) throw error;
          if (data.error) throw new Error(data.error);

          const transcribedText = data.text?.trim();
          
          if (transcribedText) {
            options?.onTranscription?.(transcribedText);
            resolve(transcribedText);
          } else {
            toast({
              title: 'No speech detected',
              description: 'Please try speaking more clearly.',
              variant: 'destructive',
            });
            resolve(null);
          }

        } catch (error) {
          console.error('Transcription error:', error);
          const errorMsg = error instanceof Error ? error.message : 'Failed to transcribe';
          options?.onError?.(errorMsg);
          toast({
            title: 'Transcription Failed',
            description: 'Could not convert speech to text. Please try again.',
            variant: 'destructive',
          });
          resolve(null);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.stop();
    });
  }, [options, toast]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setIsTranscribing(false);
  }, []);

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
