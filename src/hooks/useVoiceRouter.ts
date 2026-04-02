import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface VoiceRouterResult {
  intent: string;
  confidence: number;
  extracted: Record<string, any>;
  confirmation_message: string;
}

type VoiceState =
  | "idle"
  | "recording"
  | "transcribing"
  | "routing"
  | "done"
  | "error";

export function useVoiceRouter(projectId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<VoiceState>("idle");
  const [result, setResult] = useState<VoiceRouterResult | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    if (!projectId || !user) return;
    setError(null);
    setResult(null);
    setTranscript(null);
    setRecordingTime(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Try webm first, fall back to mp4
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setState("recording");

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err: any) {
      setError("Microphone access denied. Please allow microphone permissions.");
      setState("error");
      cleanup();
    }
  }, [projectId, user, cleanup]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        // Stop mic
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        if (blob.size < 1000) {
          setError("Recording too short. Please try again.");
          setState("error");
          resolve();
          return;
        }

        // Transcribe
        setState("transcribing");
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((res, rej) => {
            reader.onload = () => {
              const dataUrl = reader.result as string;
              res(dataUrl.split(",")[1]);
            };
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });

          const { data: transcribeData, error: transcribeError } =
            await supabase.functions.invoke("transcribe-audio", {
              body: { audio: base64 },
            });

          if (transcribeError) throw transcribeError;
          if (!transcribeData?.text) throw new Error("No transcription returned");

          const text = transcribeData.text;
          setTranscript(text);

          // Route
          setState("routing");
          const { data: routeData, error: routeError } =
            await supabase.functions.invoke("voice-router", {
              body: { transcript: text, project_id: projectId },
            });

          if (routeError) throw routeError;
          if (routeData?.error) throw new Error(routeData.error);

          setResult(routeData as VoiceRouterResult);
          setState("done");
        } catch (err: any) {
          setError(err.message || "Failed to process voice input");
          setState("error");
        }
        resolve();
      };

      recorder.stop();
    });
  }, [projectId]);

  const reset = useCallback(() => {
    setState("idle");
    setResult(null);
    setTranscript(null);
    setError(null);
    setRecordingTime(0);
    cleanup();
  }, [cleanup]);

  return {
    state,
    result,
    transcript,
    error,
    recordingTime,
    startRecording,
    stopRecording,
    reset,
    isRecording: state === "recording",
    isProcessing: state === "transcribing" || state === "routing",
  };
}
