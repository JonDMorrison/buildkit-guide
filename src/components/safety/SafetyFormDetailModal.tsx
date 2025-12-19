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
import { format } from "date-fns";
import { FileText, Camera, Download, Share2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadSafetyFormPDF, shareSafetyFormPDF } from "@/lib/safetyPdfExport";

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

interface SafetyForm {
  id: string;
  title: string;
  form_type: string;
  status: string;
  inspection_date: string;
  created_at: string;
  created_by: string;
  project_id: string;
  project?: {
    name: string;
    location: string;
  };
  creator?: {
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
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && formId) {
      fetchFormDetails();
    }
  }, [isOpen, formId]);

  const fetchFormDetails = async () => {
    if (!formId) return;

    setLoading(true);
    try {
      // Fetch form with project and creator
      const { data: formData, error: formError } = await supabase
        .from("safety_forms")
        .select("*, projects(name, location), profiles!safety_forms_created_by_fkey(full_name, email)")
        .eq("id", formId)
        .single();

      if (formError) throw formError;
      setForm({
        ...formData,
        project: formData.projects,
        creator: formData.profiles,
      });

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

      // Fetch attendees
      const { data: attendeesData } = await supabase
        .from("safety_form_attendees")
        .select("*, profiles(full_name, email)")
        .eq("safety_form_id", formId);
      setAttendees(attendeesData || []);
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
      await downloadSafetyFormPDF({ form, entries, attendees });
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
      await shareSafetyFormPDF({ form, entries, attendees });
      toast({ title: "PDF shared" });
    } catch (error) {
      toast({ title: "Share failed", variant: "destructive" });
    } finally {
      setExporting(false);
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

          {/* Photos */}
          {attachments.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Photos ({attachments.length})</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
                  >
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {entries.length === 0 && attachments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No form data available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
