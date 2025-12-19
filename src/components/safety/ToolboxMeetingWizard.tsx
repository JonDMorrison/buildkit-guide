import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SignatureCapture } from "./SignatureCapture";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { 
  ChevronLeft, ChevronRight, Loader2, Check, Users, 
  MessageSquare, ClipboardList, PenTool, AlertTriangle,
  HardHat, Flame, Zap, Truck, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { generateRecordHash } from "@/lib/recordHash";

interface ToolboxMeetingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Attendee {
  id: string;
  full_name: string;
  email: string;
  signature?: string;
  signed: boolean;
}

// Pre-built topic categories for quick selection
const TOPIC_CATEGORIES = [
  { id: "fall-protection", label: "Fall Protection", icon: AlertTriangle },
  { id: "ppe", label: "PPE Requirements", icon: HardHat },
  { id: "fire-safety", label: "Fire Safety", icon: Flame },
  { id: "electrical", label: "Electrical Safety", icon: Zap },
  { id: "equipment", label: "Equipment Operation", icon: Truck },
  { id: "housekeeping", label: "Housekeeping", icon: ShieldCheck },
];

export const ToolboxMeetingWizard = ({ isOpen, onClose, onSuccess }: ToolboxMeetingWizardProps) => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const { currentProjectId } = useCurrentProject();
  const { toast } = useToast();

  // Step 1: Meeting Info
  const [meetingDate, setMeetingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meetingTime, setMeetingTime] = useState(format(new Date(), "HH:mm"));
  const [duration, setDuration] = useState("15");
  const [location, setLocation] = useState("");

  // Step 2: Topics
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicsDiscussed, setTopicsDiscussed] = useState("");
  const [questionsRaised, setQuestionsRaised] = useState("");
  const [actionItems, setActionItems] = useState("");

  // Step 3: Attendees
  const [projectMembers, setProjectMembers] = useState<Attendee[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<Attendee[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Step 4: Signatures
  const [conductorSignature, setConductorSignature] = useState<string | null>(null);
  const [attendeeSignatures, setAttendeeSignatures] = useState<Record<string, string>>({});
  const [currentSigningAttendee, setCurrentSigningAttendee] = useState<string | null>(null);

  // Fetch project members
  useEffect(() => {
    if (isOpen && currentProjectId) {
      fetchProjectMembers();
    }
  }, [isOpen, currentProjectId]);

  const fetchProjectMembers = async () => {
    if (!currentProjectId) return;
    setLoadingMembers(true);
    
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select(`
          user_id,
          profiles!project_members_user_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq("project_id", currentProjectId);

      if (error) throw error;

      const members: Attendee[] = (data || [])
        .filter((m: any) => m.profiles)
        .map((m: any) => ({
          id: m.profiles.id,
          full_name: m.profiles.full_name || m.profiles.email,
          email: m.profiles.email,
          signed: false,
        }));

      setProjectMembers(members);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) 
        ? prev.filter(t => t !== topicId)
        : [...prev, topicId]
    );
  };

  const toggleAttendee = (attendee: Attendee) => {
    setSelectedAttendees(prev => {
      const exists = prev.find(a => a.id === attendee.id);
      if (exists) {
        return prev.filter(a => a.id !== attendee.id);
      }
      return [...prev, { ...attendee, signed: false }];
    });
  };

  const handleAttendeeSignature = (attendeeId: string, signature: string | null) => {
    if (!signature) return;
    setAttendeeSignatures(prev => ({ ...prev, [attendeeId]: signature }));
    setSelectedAttendees(prev => 
      prev.map(a => a.id === attendeeId ? { ...a, signed: true, signature } : a)
    );
    setCurrentSigningAttendee(null);
  };

  const canProceed = () => {
    if (step === 1) return meetingDate && meetingTime;
    if (step === 2) return topicsDiscussed.trim().length > 0 || selectedTopics.length > 0;
    if (step === 3) return selectedAttendees.length > 0;
    if (step === 4) return conductorSignature;
    return false;
  };

  const handleSubmit = async () => {
    if (!currentProjectId) return;
    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Build topics text
      const topicLabels = selectedTopics
        .map(id => TOPIC_CATEGORIES.find(t => t.id === id)?.label)
        .filter(Boolean);
      const fullTopicsText = [
        ...topicLabels.map(t => `• ${t}`),
        topicsDiscussed ? `\nAdditional Notes:\n${topicsDiscussed}` : ""
      ].join("\n");

      // Create safety form
      const { data: form, error: formError } = await supabase
        .from("safety_forms")
        .insert({
          project_id: currentProjectId,
          form_type: "toolbox_meeting",
          title: `Toolbox Meeting - ${format(new Date(meetingDate), "MMM d, yyyy")}`,
          status: "submitted",
          inspection_date: meetingDate,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (formError) throw formError;

      // Save form entries
      const entries = [
        { safety_form_id: form.id, field_name: "date", field_value: meetingDate },
        { safety_form_id: form.id, field_name: "time", field_value: meetingTime },
        { safety_form_id: form.id, field_name: "duration", field_value: duration },
        { safety_form_id: form.id, field_name: "location", field_value: location },
        { safety_form_id: form.id, field_name: "topics_covered", field_value: fullTopicsText },
        { safety_form_id: form.id, field_name: "questions_raised", field_value: questionsRaised },
        { safety_form_id: form.id, field_name: "action_items", field_value: actionItems },
        { safety_form_id: form.id, field_name: "conductor_signature", field_value: conductorSignature || "" },
        { safety_form_id: form.id, field_name: "attendee_count", field_value: selectedAttendees.length.toString() },
      ];

      await supabase.from("safety_entries").insert(entries);

      // Save attendees
      const attendeeRecords = selectedAttendees.map(a => ({
        safety_form_id: form.id,
        user_id: a.id,
        signed_at: a.signed ? new Date().toISOString() : null,
        signature_url: attendeeSignatures[a.id] || null,
        is_foreman: false,
      }));

      if (attendeeRecords.length > 0) {
        await supabase.from("safety_form_attendees").insert(attendeeRecords);
      }

      // Generate record hash for tamper-evidence (BC compliance)
      const recordHash = await generateRecordHash({
        formId: form.id,
        projectId: currentProjectId,
        formType: "toolbox_meeting",
        createdBy: userData.user.id,
        inspectionDate: meetingDate,
        entries: entries.map((e) => ({ field_name: e.field_name, field_value: e.field_value })),
        attendees: selectedAttendees.map((a) => ({ user_id: a.id, is_foreman: false })),
      });

      // Update form with record hash
      await supabase
        .from("safety_forms")
        .update({ record_hash: recordHash })
        .eq("id", form.id);

      toast({
        title: "Meeting Recorded",
        description: `Toolbox meeting saved with ${selectedAttendees.length} attendees.`,
      });

      onSuccess?.();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error("Error saving meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save meeting",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setMeetingDate(format(new Date(), "yyyy-MM-dd"));
    setMeetingTime(format(new Date(), "HH:mm"));
    setDuration("15");
    setLocation("");
    setSelectedTopics([]);
    setTopicsDiscussed("");
    setQuestionsRaised("");
    setActionItems("");
    setSelectedAttendees([]);
    setConductorSignature(null);
    setAttendeeSignatures({});
  };

  const signedCount = selectedAttendees.filter(a => a.signed).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Toolbox Meeting
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={(step / 4) * 100} className="h-2 flex-1" />
            <span className="text-sm text-muted-foreground">Step {step}/4</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Meeting Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Meeting Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    min="5"
                    max="120"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="e.g., Site trailer"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Topics */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Topics Discussed
              </h3>

              <p className="text-sm text-muted-foreground">
                Quick-select common topics or add custom notes
              </p>

              <div className="grid grid-cols-2 gap-2">
                {TOPIC_CATEGORIES.map((topic) => {
                  const Icon = topic.icon;
                  const isSelected = selectedTopics.includes(topic.id);
                  return (
                    <Button
                      key={topic.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={cn("h-12 justify-start gap-2", isSelected && "bg-primary")}
                      onClick={() => toggleTopic(topic.id)}
                    >
                      <Icon className="h-4 w-4" />
                      {topic.label}
                    </Button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label>Additional Topics / Notes</Label>
                <Textarea
                  placeholder="Describe specific topics discussed..."
                  value={topicsDiscussed}
                  onChange={(e) => setTopicsDiscussed(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Questions / Concerns Raised</Label>
                <Textarea
                  placeholder="Any questions or concerns from the crew..."
                  value={questionsRaised}
                  onChange={(e) => setQuestionsRaised(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Action Items</Label>
                <Textarea
                  placeholder="Follow-up actions required..."
                  value={actionItems}
                  onChange={(e) => setActionItems(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3: Attendees */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Attendees
              </h3>

              <p className="text-sm text-muted-foreground">
                Select workers who attended this meeting
              </p>

              {loadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {projectMembers.map((member) => {
                    const isSelected = selectedAttendees.some(a => a.id === member.id);
                    return (
                      <Card
                        key={member.id}
                        className={cn(
                          "p-3 cursor-pointer transition-all",
                          isSelected && "ring-2 ring-primary"
                        )}
                        onClick={() => toggleAttendee(member)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <div className="flex-1">
                            <p className="font-medium">{member.full_name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {selectedAttendees.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {selectedAttendees.length} attendee{selectedAttendees.length !== 1 ? "s" : ""} selected
                </div>
              )}
            </div>
          )}

          {/* Step 4: Signatures */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Signatures
              </h3>

              {/* Conductor Signature */}
              <Card className="p-4">
                <SignatureCapture
                  label="Meeting Conductor Signature *"
                  signature={conductorSignature}
                  onSignatureChange={setConductorSignature}
                />
              </Card>

              {/* Attendee Signatures (Optional) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Attendee Signatures (Optional)</Label>
                  <Badge variant="secondary">
                    {signedCount}/{selectedAttendees.length} signed
                  </Badge>
                </div>

                <div className="space-y-2">
                  {selectedAttendees.map((attendee) => (
                    <Card
                      key={attendee.id}
                      className={cn(
                        "p-3",
                        attendee.signed && "bg-green-50 dark:bg-green-900/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {attendee.signed ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4" />
                          )}
                          <span className="font-medium">{attendee.full_name}</span>
                        </div>
                        {!attendee.signed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentSigningAttendee(attendee.id)}
                          >
                            Sign
                          </Button>
                        )}
                      </div>

                      {currentSigningAttendee === attendee.id && (
                        <div className="mt-3 pt-3 border-t">
                          <SignatureCapture
                            label={`${attendee.full_name}'s Signature`}
                            signature={attendeeSignatures[attendee.id] || null}
                            onSignatureChange={(sig) => handleAttendeeSignature(attendee.id, sig)}
                          />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 p-4 border-t bg-muted/50">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="h-12">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="h-12 px-6">
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || submitting} className="h-12 px-6">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
