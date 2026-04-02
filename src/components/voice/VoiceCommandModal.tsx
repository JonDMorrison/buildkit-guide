import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRouter, type VoiceRouterResult } from "@/hooks/useVoiceRouter";
import { useQueryClient } from "@tanstack/react-query";

interface VoiceCommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}

const intentLabels: Record<string, string> = {
  create_task: "Task",
  log_deficiency: "Deficiency",
  create_blocker: "Blocker",
  request_manpower: "Manpower",
  log_daily: "Daily Log",
  general_query: "AI Question",
};

const intentColors: Record<string, string> = {
  create_task: "bg-blue-100 text-blue-700 border-blue-200",
  log_deficiency: "bg-red-100 text-red-700 border-red-200",
  create_blocker: "bg-amber-100 text-amber-700 border-amber-200",
  request_manpower: "bg-green-100 text-green-700 border-green-200",
  log_daily: "bg-purple-100 text-purple-700 border-purple-200",
  general_query: "bg-gray-100 text-gray-700 border-gray-200",
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function VoiceCommandModal({
  open,
  onOpenChange,
  projectId,
}: VoiceCommandModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const voice = useVoiceRouter(projectId);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-start recording when modal opens
  useEffect(() => {
    if (open && voice.state === "idle") {
      voice.startRecording();
    }
    if (!open) {
      voice.reset();
      setSaveState("idle");
      setSaveError(null);
    }
  }, [open]);

  // Auto-close on success
  useEffect(() => {
    if (saveState === "saved") {
      const timer = setTimeout(() => onOpenChange(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveState, onOpenChange]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleConfirm = async () => {
    if (!voice.result || !user || !projectId) return;
    setSaveState("saving");
    setSaveError(null);

    const { intent, extracted } = voice.result;

    try {
      switch (intent) {
        case "create_task": {
          const { error } = await supabase.from("tasks").insert({
            title: extracted.title,
            description: extracted.description || "",
            priority: extracted.priority || 2,
            due_date: extracted.due_date || null,
            assigned_trade_id: extracted.matched_trade_id || null,
            baseline_role_type: extracted.baseline_role_type || null,
            location: extracted.location || null,
            project_id: projectId,
            created_by: user.id,
            status: "not_started",
          });
          if (error) throw error;
          break;
        }
        case "log_deficiency": {
          const { error } = await supabase.from("deficiencies").insert({
            title: extracted.title,
            description: extracted.description || "",
            priority: extracted.priority || 3,
            location: extracted.location || null,
            assigned_trade_id: extracted.matched_trade_id || null,
            project_id: projectId,
            created_by: user.id,
            status: "open",
          });
          if (error) throw error;
          break;
        }
        case "create_blocker": {
          const { error } = await supabase.from("blockers").insert({
            reason: extracted.reason,
            description: extracted.description || null,
            project_id: projectId,
            created_by: user.id,
            is_resolved: false,
          });
          if (error) throw error;
          break;
        }
        case "request_manpower": {
          const { error } = await supabase.from("manpower_requests").insert({
            project_id: projectId,
            trade_id: extracted.matched_trade_id || null,
            requested_count: extracted.worker_count || 1,
            required_date:
              extracted.required_date ||
              new Date().toISOString().split("T")[0],
            reason:
              extracted.notes || `${extracted.trade_name} needed on site`,
            created_by: user.id,
            status: "pending",
          });
          if (error) throw error;
          break;
        }
        case "log_daily": {
          const today = new Date().toISOString().split("T")[0];
          // Check if today's log exists
          const { data: existing } = await supabase
            .from("daily_logs")
            .select("id")
            .eq("project_id", projectId)
            .eq("log_date", today)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from("daily_logs")
              .update({
                work_performed: extracted.work_performed,
                issues: extracted.issues || null,
                crew_count: extracted.crew_count || null,
                next_day_plan: extracted.next_day_plan || null,
              })
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("daily_logs").insert({
              project_id: projectId,
              log_date: today,
              work_performed: extracted.work_performed,
              issues: extracted.issues || null,
              crew_count: extracted.crew_count || null,
              next_day_plan: extracted.next_day_plan || null,
              created_by: user.id,
            });
            if (error) throw error;
          }
          break;
        }
        case "general_query":
          // TODO: Open AI assist panel with query pre-filled
          toast({
            title: "Sent to AI Assistant",
            description: extracted.query,
          });
          setSaveState("saved");
          return;
        default:
          throw new Error(`Unknown intent: ${intent}`);
      }

      // Save voice transcription record
      if (voice.transcript) {
        await supabase.from("voice_transcriptions").insert({
          user_id: user.id,
          project_id: projectId,
          transcription_text: voice.transcript,
        }).then(() => {});
      }

      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["morning-briefing"] });
      toast({
        title: `${intentLabels[intent] || "Item"} created`,
        description: voice.result.confirmation_message,
      });
      setSaveState("saved");
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(err.message || "Failed to save");
      setSaveState("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="sr-only">Voice Command</DialogTitle>

        <div className="flex flex-col items-center py-4 gap-6">
          {/* Idle — should not normally show since we auto-start */}
          {voice.state === "idle" && (
            <>
              <button
                onClick={voice.startRecording}
                className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Mic className="h-10 w-10 text-primary" />
              </button>
              <p className="text-sm text-muted-foreground">Tap to speak</p>
            </>
          )}

          {/* Recording */}
          {voice.state === "recording" && (
            <>
              <button
                onClick={voice.stopRecording}
                className="w-24 h-24 rounded-full bg-destructive/10 border-2 border-destructive flex items-center justify-center animate-pulse"
              >
                <MicOff className="h-10 w-10 text-destructive" />
              </button>
              <div className="text-center">
                <p className="text-sm font-medium text-destructive">
                  Listening...
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {formatTime(voice.recordingTime)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tap to stop
                </p>
              </div>
            </>
          )}

          {/* Processing (transcribing + routing) */}
          {voice.isProcessing && (
            <>
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {voice.state === "transcribing"
                    ? "Transcribing..."
                    : "Understanding what you said..."}
                </p>
                {voice.transcript && (
                  <p className="text-xs text-muted-foreground mt-2 italic max-w-xs">
                    "{voice.transcript}"
                  </p>
                )}
              </div>
            </>
          )}

          {/* Confirmation */}
          {voice.state === "done" && voice.result && saveState === "idle" && (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    intentColors[voice.result.intent] || intentColors.general_query
                  )}
                >
                  {intentLabels[voice.result.intent] || "Unknown"}
                </Badge>
              </div>

              <p className="text-center text-sm font-medium leading-relaxed px-4">
                {voice.result.confirmation_message}
              </p>

              {voice.transcript && (
                <p className="text-center text-xs text-muted-foreground italic">
                  You said: "{voice.transcript}"
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    voice.reset();
                    voice.startRecording();
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={handleConfirm}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm
                </Button>
              </div>
            </div>
          )}

          {/* Saving */}
          {saveState === "saving" && (
            <>
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-medium">
                Creating{" "}
                {voice.result
                  ? intentLabels[voice.result.intent]?.toLowerCase() || "item"
                  : "item"}
                ...
              </p>
            </>
          )}

          {/* Success */}
          {saveState === "saved" && (
            <>
              <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-sm font-medium text-green-700">Done!</p>
            </>
          )}

          {/* Error (voice error or save error) */}
          {(voice.state === "error" || saveState === "error") && (
            <>
              <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center px-4">
                {voice.error || saveError || "Something went wrong"}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  voice.reset();
                  setSaveState("idle");
                  setSaveError(null);
                }}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
