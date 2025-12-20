import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignatureCapture } from "./SignatureCapture";
import { VoiceInputButton } from "./VoiceInputButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { generateAndPersistRecordHash } from "@/lib/recordHash";
import {
  ShieldBan,
  AlertTriangle,
  Info,
  FileWarning,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RightToRefuseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string | null;
  isWorkerMode?: boolean; // When true, hide investigation/resolution fields
}

const REFUSAL_REASONS = [
  { id: "equipment", label: "Defective equipment or tools" },
  { id: "training", label: "Lack of proper training" },
  { id: "ppe", label: "Missing or inadequate PPE" },
  { id: "conditions", label: "Unsafe work conditions" },
  { id: "chemical", label: "Chemical or hazardous material exposure" },
  { id: "physical", label: "Physical hazard (fall, crush, struck-by)" },
  { id: "weather", label: "Weather-related danger" },
  { id: "fatigue", label: "Fatigue or exhaustion concern" },
  { id: "other", label: "Other (specify below)" },
];

const RESOLUTION_STATUS = [
  { id: "pending_investigation", label: "Pending Investigation" },
  { id: "under_review", label: "Under Review" },
  { id: "resolved_safe", label: "Resolved - Work Deemed Safe" },
  { id: "resolved_modified", label: "Resolved - Work Modified" },
  { id: "resolved_refused", label: "Resolved - Refusal Upheld" },
  { id: "escalated", label: "Escalated to Safety Committee/Ministry" },
];

export const RightToRefuseForm = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  isWorkerMode = false,
}: RightToRefuseFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProject, setSelectedProject] = useState(projectId || "");
  const { toast } = useToast();

  // Form fields
  const [taskActivity, setTaskActivity] = useState("");
  const [location, setLocation] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [reasonDetails, setReasonDetails] = useState("");
  const [immediateControls, setImmediateControls] = useState("");
  const [supervisorNotified, setSupervisorNotified] = useState(false);
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorNotifiedAt, setSupervisorNotifiedAt] = useState("");
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [resolutionStatus, setResolutionStatus] = useState("pending_investigation");
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      if (projectId) setSelectedProject(projectId);
    }
  }, [isOpen, projectId]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("is_deleted", false)
      .order("name");
    setProjects(data || []);
  };

  const toggleReason = (reasonId: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reasonId) ? prev.filter((r) => r !== reasonId) : [...prev, reasonId]
    );
  };

  const handleVoiceInput = useCallback(
    (field: "reason" | "controls" | "notes", text: string) => {
      const setters = {
        reason: setReasonDetails,
        controls: setImmediateControls,
        notes: setInvestigationNotes,
      };
      const current = {
        reason: reasonDetails,
        controls: immediateControls,
        notes: investigationNotes,
      };
      setters[field](current[field] ? `${current[field]}\n${text}` : text);
    },
    [reasonDetails, immediateControls, investigationNotes]
  );

  const canSubmit =
    selectedProject &&
    taskActivity.trim() &&
    selectedReasons.length > 0 &&
    supervisorNotified &&
    signature;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Create safety form with right_to_refuse type
      const { data: form, error: formError } = await supabase
        .from("safety_forms")
        .insert({
          project_id: selectedProject,
          form_type: "right_to_refuse",
          title: `Right to Refuse - ${taskActivity.slice(0, 50)}`,
          status: "submitted",
          inspection_date: format(new Date(), "yyyy-MM-dd"),
          created_by: user.user.id,
          device_info: { userAgent: navigator.userAgent, platform: navigator.platform },
        })
        .select()
        .single();

      if (formError) throw formError;

      // Create entries for all form fields
      // In worker mode, investigation and resolution fields are left empty for employer to fill
      const isResolved = !isWorkerMode && (resolutionStatus.startsWith("resolved_") || resolutionStatus === "escalated");
      const entries = [
        { safety_form_id: form.id, field_name: "task_activity", field_value: taskActivity },
        { safety_form_id: form.id, field_name: "location", field_value: location },
        { safety_form_id: form.id, field_name: "refusal_reasons", field_value: JSON.stringify(selectedReasons) },
        { safety_form_id: form.id, field_name: "reason_details", field_value: reasonDetails },
        { safety_form_id: form.id, field_name: "immediate_controls", field_value: immediateControls },
        { safety_form_id: form.id, field_name: "supervisor_notified", field_value: supervisorNotified ? "yes" : "no" },
        { safety_form_id: form.id, field_name: "supervisor_name", field_value: supervisorName },
        { safety_form_id: form.id, field_name: "supervisor_notified_at", field_value: supervisorNotifiedAt },
        // Only include investigation/resolution if not in worker mode (employer fills these)
        { safety_form_id: form.id, field_name: "investigation_notes", field_value: isWorkerMode ? "" : investigationNotes },
        { safety_form_id: form.id, field_name: "resolution_status", field_value: isWorkerMode ? "pending_investigation" : resolutionStatus },
        { safety_form_id: form.id, field_name: "worker_signature", field_value: signature },
        { safety_form_id: form.id, field_name: "submitted_at", field_value: new Date().toISOString() },
        // Track if this was worker-initiated for audit purposes
        { safety_form_id: form.id, field_name: "worker_initiated", field_value: isWorkerMode ? "true" : "false" },
        // Store resolved_at timestamp when status is resolved
        { safety_form_id: form.id, field_name: "resolved_at", field_value: isResolved ? new Date().toISOString() : "" },
      ];

      await supabase.from("safety_entries").insert(entries);

      // Create attendee record for the worker who refused
      await supabase.from("safety_form_attendees").insert({
        safety_form_id: form.id,
        user_id: user.user.id,
        is_foreman: false,
        signed_at: new Date().toISOString(),
        signature_url: signature,
      });

      // Generate record hash for tamper-evidence (BC compliance)
      // Use generateAndPersistRecordHash for deterministic hashing from DB state
      const recordHash = await generateAndPersistRecordHash(form.id);
      if (!recordHash) {
        console.error("[RightToRefuseForm] Failed to generate record hash");
      }

      toast({ title: "Success", description: "Right to Refuse record submitted" });
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTaskActivity("");
    setLocation("");
    setSelectedReasons([]);
    setReasonDetails("");
    setImmediateControls("");
    setSupervisorNotified(false);
    setSupervisorName("");
    setSupervisorNotifiedAt("");
    setInvestigationNotes("");
    setResolutionStatus("pending_investigation");
    setSignature(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-xl flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-destructive" />
            {isWorkerMode ? "Report Unsafe Work" : "Right to Refuse Unsafe Work"}
          </DialogTitle>
          {isWorkerMode && (
            <p className="text-sm text-muted-foreground mt-1">
              Submit your refusal. Your supervisor will be notified to investigate.
            </p>
          )}
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Explainer Panel */}
          <Card className="p-4 bg-amber-500/10 border-amber-500/30">
            <button
              onClick={() => setShowExplainer(!showExplainer)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  Your Right to Refuse
                </span>
              </div>
              {showExplainer ? (
                <ChevronUp className="h-4 w-4 text-amber-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-amber-600" />
              )}
            </button>

            {showExplainer && (
              <div className="mt-3 text-sm text-amber-800 dark:text-amber-200 space-y-2">
                <p>
                  Workers have the legal right to refuse work they believe is dangerous to
                  themselves or others. This is protected under occupational health and safety
                  legislation across all Canadian jurisdictions.
                </p>
                <p>
                  When you exercise this right, the employer must investigate and either resolve
                  the concern or have it reviewed by a safety committee or inspector.
                </p>
                <p className="font-medium">
                  You cannot be disciplined for exercising this right in good faith.
                </p>
              </div>
            )}
          </Card>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task/Activity */}
          <div className="space-y-2">
            <Label className="text-base font-medium">
              Task or Activity Being Refused
              <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
            </Label>
            <Input
              value={taskActivity}
              onChange={(e) => setTaskActivity(e.target.value)}
              placeholder="e.g. Working on scaffold at 4th floor"
              className="h-12"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Tower A, Level 4, Grid B-12"
              className="h-12"
            />
          </div>

          {/* Reasons */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Reason(s) for Refusal
              <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
            </Label>
            <div className="space-y-2">
              {REFUSAL_REASONS.map((reason) => (
                <div
                  key={reason.id}
                  onClick={() => toggleReason(reason.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    "min-h-[48px] active:scale-[0.98] touch-manipulation",
                    selectedReasons.includes(reason.id)
                      ? "border-destructive bg-destructive/5 ring-1 ring-destructive"
                      : "border-border hover:bg-accent/50"
                  )}
                >
                  <Checkbox
                    checked={selectedReasons.includes(reason.id)}
                    className="h-5 w-5"
                  />
                  <span className="text-sm font-medium">{reason.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reason Details */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Describe the Hazard in Detail</Label>
            <div className="flex gap-2">
              <Textarea
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Describe why you believe this work is unsafe..."
                className="min-h-[100px] flex-1"
              />
              <VoiceInputButton onTranscription={(t) => handleVoiceInput("reason", t)} />
            </div>
          </div>

          {/* Immediate Controls */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Immediate Controls Taken</Label>
            <div className="flex gap-2">
              <Textarea
                value={immediateControls}
                onChange={(e) => setImmediateControls(e.target.value)}
                placeholder="What actions have been taken to address the hazard? (e.g. area cordoned off, work stopped)"
                className="min-h-[80px] flex-1"
              />
              <VoiceInputButton onTranscription={(t) => handleVoiceInput("controls", t)} />
            </div>
          </div>

          {/* Supervisor Notification */}
          <Card className="p-4">
            <div
              onClick={() => setSupervisorNotified(!supervisorNotified)}
              className={cn(
                "flex items-center gap-3 cursor-pointer mb-4",
                "active:scale-[0.98] touch-manipulation"
              )}
            >
              <Checkbox
                checked={supervisorNotified}
                className="h-6 w-6"
              />
              <div>
                <Label className="text-base font-medium cursor-pointer">
                  Supervisor Has Been Notified
                  <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  You must notify your supervisor before or immediately after refusing
                </p>
              </div>
            </div>

            {supervisorNotified && (
              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Supervisor Name</Label>
                  <Input
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    placeholder="Enter supervisor's name"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Notified</Label>
                  <Input
                    type="datetime-local"
                    value={supervisorNotifiedAt}
                    onChange={(e) => setSupervisorNotifiedAt(e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Investigation Notes - Only visible to PM/Foreman, not workers */}
          {!isWorkerMode && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Investigation Notes</Label>
              <div className="flex gap-2">
                <Textarea
                  value={investigationNotes}
                  onChange={(e) => setInvestigationNotes(e.target.value)}
                  placeholder="Notes from investigation, discussions, or follow-up actions..."
                  className="min-h-[80px] flex-1"
                />
                <VoiceInputButton onTranscription={(t) => handleVoiceInput("notes", t)} />
              </div>
            </div>
          )}

          {/* Resolution Status - Only visible to PM/Foreman, not workers */}
          {!isWorkerMode && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Resolution Status</Label>
              <Select value={resolutionStatus} onValueChange={setResolutionStatus}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_STATUS.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Worker Signature */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-base font-medium">
                  Worker Signature
                  <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  I confirm this refusal is made in good faith
                </p>
              </div>
              {signature && (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30">
                  <Check className="h-3 w-3" />
                  Signed
                </Badge>
              )}
            </div>
            <SignatureCapture
              label=""
              signature={signature}
              onSignatureChange={setSignature}
            />
          </Card>
        </div>

        {/* Submit */}
        <div className="p-6 pt-4 border-t sticky bottom-0 bg-background">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full h-14 text-base gap-2"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileWarning className="h-5 w-5" />
            )}
            Submit Right to Refuse Record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
