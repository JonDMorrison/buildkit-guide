import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Square, Loader2, Check, Edit2 } from "lucide-react";
import { format } from "date-fns";

interface VoiceToTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  projectId: string;
}

interface ExtractedTask {
  title: string;
  description: string;
  priority: number;
  due_date: string | null;
  assigned_trade_id: string | null;
  assigned_trade_name?: string;
  estimated_hours: number | null;
  location: string | null;
  is_blocked: boolean;
  blocker_reason: string | null;
  project_id: string;
}

export const VoiceToTaskModal = ({
  isOpen,
  onClose,
  onTaskCreated,
  projectId,
}: VoiceToTaskModalProps) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [extractedTask, setExtractedTask] = useState<ExtractedTask | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchTrades();
    }
  }, [isOpen]);

  const fetchTrades = async () => {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching trades:", error);
    } else {
      setTrades(data || []);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Recording started", description: "Speak your task description..." });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      await new Promise((resolve) => {
        reader.onloadend = resolve;
      });

      const base64Audio = (reader.result as string).split(",")[1];

      // Step 1: Transcribe audio
      toast({ title: "Transcribing...", description: "Converting speech to text..." });
      
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
        "transcribe-audio",
        { body: { audio: base64Audio } }
      );

      if (transcriptError) throw transcriptError;
      if (!transcriptData?.text) throw new Error("No transcription received");

      const transcription = transcriptData.text;
      setTranscribedText(transcription);

      // Step 2: Extract structured task
      toast({ title: "Extracting task...", description: "Creating structured task data..." });
      
      const { data: taskData, error: taskError } = await supabase.functions.invoke(
        "extract-task",
        { body: { text: transcription, projectId, trades } }
      );

      if (taskError) throw taskError;
      if (!taskData?.task) throw new Error("No task data received");

      setExtractedTask(taskData.task);
      toast({
        title: "Task extracted!",
        description: "Review and confirm the task details.",
      });
    } catch (error: any) {
      console.error("Error processing audio:", error);
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process voice input. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateTask = async () => {
    if (!extractedTask) return;

    setIsProcessing(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: extractedTask.title,
          description: extractedTask.description,
          priority: extractedTask.priority,
          due_date: extractedTask.due_date,
          assigned_trade_id: extractedTask.assigned_trade_id,
          estimated_hours: extractedTask.estimated_hours,
          location: extractedTask.location,
          project_id: projectId,
          created_by: user.user.id,
          status: "not_started",
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create blocker if needed
      if (extractedTask.is_blocked && extractedTask.blocker_reason && task) {
        await supabase.from("blockers").insert({
          task_id: task.id,
          reason: extractedTask.blocker_reason,
          created_by: user.user.id,
          is_resolved: false,
        });
      }

      toast({
        title: "Task created!",
        description: `"${extractedTask.title}" has been added to the project.`,
      });

      onTaskCreated();
      handleClose();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setTranscribedText("");
    setExtractedTask(null);
    setIsRecording(false);
    setIsProcessing(false);
    setIsEditing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Voice to Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recording Section */}
          {!extractedTask && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Button
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`h-24 w-24 rounded-full ${
                  isRecording ? "bg-destructive hover:bg-destructive/90" : ""
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="h-12 w-12 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-12 w-12" />
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {isProcessing
                  ? "Processing your voice..."
                  : isRecording
                  ? "Tap to stop recording"
                  : "Tap to start recording"}
              </p>
              {transcribedText && (
                <Card className="p-4 w-full">
                  <Label className="text-sm font-semibold mb-2 block">Transcribed:</Label>
                  <p className="text-sm text-foreground">{transcribedText}</p>
                </Card>
              )}
            </div>
          )}

          {/* Task Preview Section */}
          {extractedTask && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Review Task</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {isEditing ? "Done Editing" : "Edit"}
                </Button>
              </div>

              <Card className="p-4 space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={extractedTask.title}
                        onChange={(e) =>
                          setExtractedTask({ ...extractedTask, title: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={extractedTask.description}
                        onChange={(e) =>
                          setExtractedTask({ ...extractedTask, description: e.target.value })
                        }
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={extractedTask.location || ""}
                        onChange={(e) =>
                          setExtractedTask({ ...extractedTask, location: e.target.value })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">Title</Label>
                      <p className="font-semibold">{extractedTask.title}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm">{extractedTask.description}</p>
                    </div>
                    {extractedTask.location && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Location</Label>
                        <p className="text-sm">{extractedTask.location}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Priority</Label>
                        <p className="text-sm">
                          {extractedTask.priority === 1
                            ? "Low"
                            : extractedTask.priority === 2
                            ? "Medium"
                            : "High"}
                        </p>
                      </div>
                      {extractedTask.due_date && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Due Date</Label>
                          <p className="text-sm">
                            {format(new Date(extractedTask.due_date), "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                    </div>
                    {extractedTask.estimated_hours && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Estimated Hours</Label>
                        <p className="text-sm">{extractedTask.estimated_hours}h</p>
                      </div>
                    )}
                    {extractedTask.assigned_trade_name && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Assigned Trade</Label>
                        <p className="text-sm">{extractedTask.assigned_trade_name}</p>
                      </div>
                    )}
                    {extractedTask.is_blocked && extractedTask.blocker_reason && (
                      <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                        <Label className="text-xs text-destructive font-semibold">
                          BLOCKED
                        </Label>
                        <p className="text-sm text-destructive mt-1">
                          {extractedTask.blocker_reason}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </Card>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setExtractedTask(null);
                    setTranscribedText("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button
                  onClick={handleCreateTask}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Create Task
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
