import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { FileText, Camera, Download, Share2, Loader2, FileEdit, Users, CheckCircle, Clock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadSafetyFormPDF, shareSafetyFormPDF } from "@/lib/safetyPdfExport";
import { assertRecordHashPresent } from "@/lib/recordHash";
import { AmendmentRequestModal } from "./AmendmentRequestModal";
import { AmendmentHistory } from "./AmendmentHistory";
import { RightToRefuseTimeline } from "./RightToRefuseTimeline";
import { SafetyAssurancePanel } from "./SafetyAssurancePanel";
import { useProjectRole } from "@/hooks/useProjectRole";
import { getSignedUrl } from "@/hooks/useSignedUrl";

interface SafetyFormDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string | null;
}

interface FormEntry {
  id: string;
  field_name: string;
  field_value: string | null;
  notes: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

interface Attendee {
  id: string;
  user_id: string;
  is_foreman: boolean;
  signed_at: string | null;
  signature_url: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface Acknowledgment {
  id: string;
  user_id: string;
  acknowledged_at: string;
  signature_url: string | null;
  initiated_by_user_id?: string | null;
  initiation_method?: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
  initiator?: {
    full_name: string | null;
    email: string;
  };
}

interface SafetyForm {
  id: string;
  title: string;
  form_type: string;
  status: string;
  inspection_date: string;
  created_at: string;
  created_by: string;
  project_id: string;
  record_hash?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  project?: {
    name: string;
    location: string;
    job_number?: string | null;
  };
  creator?: {
    full_name: string | null;
    email: string;
  };
  reviewer?: {
    full_name: string | null;
    email: string;
  };
}

const getFormTypeLabel = (formType: string) => {
  const labels: Record<string, string> = {
    daily_safety_log: "Daily Safety Log",
    toolbox_meeting: "Toolbox Meeting",
    hazard_id: "Hazard ID",
    incident_report: "Incident Report",
    near_miss: "Near Miss",
    right_to_refuse: "Right to Refuse",
    visitor_log: "Visitor Log",
  };
  return labels[formType] || formType;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "reviewed":
      return "bg-status-complete text-status-complete-foreground";
    case "submitted":
      return "bg-status-info text-status-info-foreground";
    case "draft":
      return "bg-status-progress text-status-progress-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const SafetyFormDetailModal = ({
  isOpen,
  onClose,
  formId,
}: SafetyFormDetailModalProps) => {
  const [form, setForm] = useState<SafetyForm | null>(null);
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<Acknowledgment[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const { toast } = useToast();
  const { canSubmitSafety, canManageProject } = useProjectRole(form?.project_id);
  
  const canRequestAmendment = form?.project_id ? canSubmitSafety(form.project_id) : false;
  const canReview = form?.project_id ? canManageProject(form.project_id) : false;

  useEffect(() => {
    if (isOpen && formId) {
      fetchFormDetails();
    }
  }, [isOpen, formId]);

  const fetchFormDetails = async () => {
    if (!formId) return;

    setLoading(true);
    try {
      // Fetch form with project, creator, and reviewer
      const { data: formData, error: formError } = await supabase
        .from("safety_forms")
        .select(`
          *, 
          projects(name, location, job_number), 
          profiles!safety_forms_created_by_fkey(full_name, email),
          reviewer:profiles!safety_forms_reviewed_by_fkey(full_name, email)
        `)
        .eq("id", formId)
        .single();

      if (formError) throw formError;
      
      const formObj = {
        ...formData,
        project: formData.projects,
        creator: formData.profiles,
        reviewer: formData.reviewer,
      };
      
      // Regression check: warn if submitted/reviewed form lacks record_hash
      assertRecordHashPresent(formObj);
      
      setForm(formObj);

      // Fetch entries
      const { data: entriesData } = await supabase
        .from("safety_entries")
        .select("*")
        .eq("safety_form_id", formId);
      setEntries(entriesData || []);

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from("attachments")
        .select("*")
        .eq("safety_form_id", formId);
      setAttachments(attachmentsData || []);

      // Generate signed URLs for attachments
      const urls: Record<string, string> = {};
      for (const att of attachmentsData || []) {
        const url = await getSignedUrl(att.file_url, 'deficiency-photos');
        if (url) {
          urls[att.id] = url;
        }
      }
      setSignedUrls(urls);

      // Fetch attendees
      const { data: attendeesData } = await supabase
        .from("safety_form_attendees")
        .select("*, profiles(full_name, email)")
        .eq("safety_form_id", formId);
      setAttendees(attendeesData || []);

      // Fetch acknowledgments with both worker profile and initiator profile
      const { data: acksData } = await supabase
        .from("safety_form_acknowledgments")
        .select(`
          *,
          profiles!safety_form_acknowledgments_user_id_fkey(full_name, email),
          initiator:profiles!safety_form_acknowledgments_initiated_by_user_id_fkey(full_name, email)
        `)
        .eq("safety_form_id", formId);
      setAcknowledgments(acksData || []);
    } catch (error) {
      console.error("Error fetching form details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!form) return;
    setExporting(true);
    try {
      await downloadSafetyFormPDF({ form, entries, attendees, acknowledgments });
      toast({ title: "PDF downloaded" });
    } catch (error) {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleSharePDF = async () => {
    if (!form) return;
    setExporting(true);
    try {
      await shareSafetyFormPDF({ form, entries, attendees, acknowledgments });
      toast({ title: "PDF shared" });
    } catch (error) {
      toast({ title: "Share failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!form || form.reviewed_at) return;
    
    setMarkingReviewed(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("safety_forms")
        .update({
          status: "reviewed",
          reviewed_by: user.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", form.id);

      if (error) throw error;

      toast({ title: "Form marked as reviewed" });
      fetchFormDetails();
    } catch (error: any) {
      toast({ title: "Failed to mark as reviewed", description: error.message, variant: "destructive" });
    } finally {
      setMarkingReviewed(false);
    }
  };

  const renderFieldValue = (entry: FormEntry) => {
    // Check if it's a signature (base64 data URL)
    if (entry.field_value?.startsWith("data:image")) {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{entry.field_name}</Label>
          <div className="border border-border rounded-lg overflow-hidden bg-background">
            <img
              src={entry.field_value}
              alt={entry.field_name}
              className="w-full h-32 object-contain"
            />
          </div>
          {entry.notes && (
            <p className="text-sm text-muted-foreground">{entry.notes}</p>
          )}
        </div>
      );
    }

    // Regular field
    return (
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{entry.field_name}</Label>
        <div className="text-foreground">
          {entry.field_value || <span className="text-muted-foreground italic">No value</span>}
        </div>
        {entry.notes && (
          <p className="text-sm text-muted-foreground">{entry.notes}</p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <Skeleton className="h-8 w-64" />
          </DialogHeader>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!form) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-xl mb-2">{form.title}</DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {getFormTypeLabel(form.form_type)}
                  </Badge>
                  <Badge className={getStatusColor(form.status)}>
                    {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(form.inspection_date), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handleSharePDF} disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={handleDownloadPDF} disabled={exporting}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Review Status & Actions */}
            {form.reviewed_at && form.reviewer ? (
              <Card className="p-3 bg-green-500/10 border-green-500/30">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Reviewed by {form.reviewer.full_name || form.reviewer.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    on {format(new Date(form.reviewed_at), "MMM d 'at' h:mm a")}
                  </span>
                </div>
              </Card>
            ) : canReview && form.status === "submitted" ? (
              <Card className="p-3 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">Pending review</span>
                  </div>
                  <Button size="sm" onClick={handleMarkReviewed} disabled={markingReviewed}>
                    {markingReviewed && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark as Reviewed
                  </Button>
                </div>
              </Card>
            ) : null}

            {/* Record Integrity Badge */}
            {form.record_hash && (
              <Card className="p-3 bg-muted/50 border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-mono">
                    Record Hash: {form.record_hash.substring(0, 16)}...
                  </span>
                  <span className="text-xs">• Tamper-evident record</span>
                </div>
              </Card>
            )}

            {/* Amendment History */}
            <AmendmentHistory 
              formId={form.id} 
              projectId={form.project_id}
              onRefresh={fetchFormDetails}
            />

            {/* Right to Refuse Timeline */}
            {form.form_type === "right_to_refuse" && entries.length > 0 && (
              <RightToRefuseTimeline 
                entries={entries.map(e => ({ field_name: e.field_name, field_value: e.field_value }))}
                createdAt={form.created_at}
              />
            )}

            {/* Form Entries */}
            {entries.length > 0 && (
              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Form Details</h3>
                </div>
                {entries.map((entry) => (
                  <div key={entry.id} className="pb-4 border-b last:border-b-0 last:pb-0">
                    {renderFieldValue(entry)}
                  </div>
                ))}
              </Card>
            )}

            {/* Worker Acknowledgments */}
            {acknowledgments.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Worker Acknowledgments ({acknowledgments.length})</h3>
                </div>
                <div className="space-y-2">
                  {acknowledgments.map((ack) => (
                    <div key={ack.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">
                          {ack.profiles?.full_name || ack.profiles?.email || "Unknown"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(ack.acknowledged_at), "h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Photos */}
            {attachments.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Photos ({attachments.length})</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {attachments.map((attachment) => {
                    const url = signedUrls[attachment.id];
                    return (
                      <div
                        key={attachment.id}
                        className={`relative aspect-square rounded-lg overflow-hidden border border-border bg-muted ${!url ? 'flex items-center justify-center' : ''}`}
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={attachment.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {entries.length === 0 && attachments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No form data available</p>
              </div>
            )}

            {/* Amendment Request Button */}
            {canRequestAmendment && form.status !== "draft" && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAmendmentModal(true)}
                >
                  <FileEdit className="h-4 w-4 mr-2" />
                  Request Amendment
                </Button>
              </>
            )}

            {/* Safety Assurance Panel - compact version for modal footer */}
            <SafetyAssurancePanel variant="compact" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Amendment Request Modal */}
      <AmendmentRequestModal
        isOpen={showAmendmentModal}
        onClose={() => setShowAmendmentModal(false)}
        formId={form.id}
        formTitle={form.title}
        currentEntries={entries}
        onSuccess={fetchFormDetails}
      />
    </>
  );
};
