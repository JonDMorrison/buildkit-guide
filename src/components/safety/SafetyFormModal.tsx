import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignatureCapture } from "./SignatureCapture";
import { PhotoUpload } from "../deficiencies/PhotoUpload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface SafetyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
  formType: string;
}

const formTemplates: Record<string, { title: string; fields: Array<{ name: string; label: string; type: string; required?: boolean }> }> = {
  "daily_safety_log": {
    title: "Daily Safety Log",
    fields: [
      { name: "date", label: "Date", type: "date", required: true },
      { name: "weather", label: "Weather Conditions", type: "text" },
      { name: "crew_count", label: "Crew Count", type: "number" },
      { name: "hazards_identified", label: "Hazards Identified", type: "textarea" },
      { name: "ppe_compliance", label: "PPE Compliance", type: "select" },
      { name: "incidents", label: "Incidents/Near Misses", type: "textarea" },
      { name: "corrective_actions", label: "Corrective Actions Taken", type: "textarea" },
    ],
  },
  "toolbox_meeting": {
    title: "Weekly Toolbox Meeting",
    fields: [
      { name: "date", label: "Meeting Date", type: "date", required: true },
      { name: "attendees", label: "Attendees", type: "textarea", required: true },
      { name: "topics_covered", label: "Topics Covered", type: "textarea", required: true },
      { name: "questions_raised", label: "Questions/Concerns Raised", type: "textarea" },
      { name: "action_items", label: "Action Items", type: "textarea" },
      { name: "next_meeting", label: "Next Meeting Date", type: "date" },
    ],
  },
  "hazard_id": {
    title: "Hazard Identification",
    fields: [
      { name: "date", label: "Date Identified", type: "date", required: true },
      { name: "location", label: "Location", type: "text", required: true },
      { name: "hazard_type", label: "Hazard Type", type: "select", required: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "severity", label: "Severity Level", type: "select", required: true },
      { name: "immediate_action", label: "Immediate Action Taken", type: "textarea" },
      { name: "long_term_solution", label: "Long-term Solution", type: "textarea" },
    ],
  },
  "incident_report": {
    title: "Incident Report",
    fields: [
      { name: "date", label: "Incident Date", type: "date", required: true },
      { name: "time", label: "Incident Time", type: "time", required: true },
      { name: "location", label: "Location", type: "text", required: true },
      { name: "incident_type", label: "Incident Type", type: "select", required: true },
      { name: "persons_involved", label: "Persons Involved", type: "textarea", required: true },
      { name: "description", label: "Description of Incident", type: "textarea", required: true },
      { name: "injuries", label: "Injuries Sustained", type: "textarea" },
      { name: "witnesses", label: "Witnesses", type: "textarea" },
      { name: "immediate_response", label: "Immediate Response", type: "textarea" },
      { name: "root_cause", label: "Root Cause Analysis", type: "textarea" },
    ],
  },
  "visitor_log": {
    title: "Visitor Log",
    fields: [
      { name: "date", label: "Visit Date", type: "date", required: true },
      { name: "visitor_name", label: "Visitor Name", type: "text", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "purpose", label: "Purpose of Visit", type: "text", required: true },
      { name: "host", label: "Host/Escort", type: "text", required: true },
      { name: "time_in", label: "Time In", type: "time", required: true },
      { name: "time_out", label: "Time Out", type: "time" },
      { name: "ppe_provided", label: "PPE Provided", type: "textarea" },
      { name: "safety_briefing", label: "Safety Briefing Completed", type: "select" },
    ],
  },
};

export const SafetyFormModal = ({
  isOpen,
  onClose,
  onCreate,
  formType,
}: SafetyFormModalProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [projectId, setProjectId] = useState("");
  const { toast } = useToast();

  const template = formTemplates[formType] || formTemplates["daily_safety_log"];

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      // Initialize form data
      const initialData: Record<string, string> = {};
      template.fields.forEach(field => {
        if (field.type === "date") {
          initialData[field.name] = new Date().toISOString().split("T")[0];
        } else {
          initialData[field.name] = "";
        }
      });
      setFormData(initialData);
    }
  }, [isOpen, formType]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .eq("is_deleted", false)
      .order("name");

    if (error) {
      console.error("Error fetching projects:", error);
      return;
    }
    setProjects(data || []);
  };

  const saveDraft = async () => {
    if (!projectId) {
      toast({
        title: "Validation Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Create draft form
      const { data: form, error: formError } = await supabase
        .from("safety_forms")
        .insert({
          project_id: projectId,
          form_type: formType,
          title: template.title,
          status: "draft",
          inspection_date: formData.date || new Date().toISOString().split("T")[0],
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (formError) throw formError;

      // Save form entries
      const entries = Object.entries(formData).map(([fieldName, fieldValue]) => ({
        safety_form_id: form.id,
        field_name: fieldName,
        field_value: fieldValue,
      }));

      if (signature) {
        entries.push({
          safety_form_id: form.id,
          field_name: "signature",
          field_value: signature,
        });
      }

      if (entries.length > 0) {
        const { error: entriesError } = await supabase
          .from("safety_entries")
          .insert(entries);

        if (entriesError) throw entriesError;
      }

      toast({
        title: "Draft Saved",
        description: "Form saved as draft",
      });
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({
        title: "Validation Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    const missingFields = template.fields
      .filter(field => field.required && !formData[field.name])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Create form
      const { data: form, error: formError } = await supabase
        .from("safety_forms")
        .insert({
          project_id: projectId,
          form_type: formType,
          title: template.title,
          status: "submitted",
          inspection_date: formData.date || new Date().toISOString().split("T")[0],
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (formError) throw formError;

      // Save form entries
      const entries = Object.entries(formData).map(([fieldName, fieldValue]) => ({
        safety_form_id: form.id,
        field_name: fieldName,
        field_value: fieldValue,
      }));

      if (signature) {
        entries.push({
          safety_form_id: form.id,
          field_name: "signature",
          field_value: signature,
        });
      }

      if (entries.length > 0) {
        const { error: entriesError } = await supabase
          .from("safety_entries")
          .insert(entries);

        if (entriesError) throw entriesError;
      }

      // Upload photos
      if (photos.length > 0) {
        const uploadPromises = photos.map(async (photo, index) => {
          const fileExt = photo.name.split(".").pop();
          const fileName = `${form.id}/${Date.now()}_${index}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("deficiency-photos")
            .upload(fileName, photo);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("deficiency-photos")
            .getPublicUrl(fileName);

          await supabase.from("attachments").insert({
            safety_form_id: form.id,
            project_id: projectId,
            file_name: photo.name,
            file_type: photo.type,
            file_url: urlData.publicUrl,
            file_size: photo.size,
            uploaded_by: userData.user.id,
          });
        });

        await Promise.all(uploadPromises);
      }

      toast({
        title: "Success",
        description: "Safety form submitted successfully",
      });

      setFormData({});
      setSignature(null);
      setPhotos([]);
      setProjectId("");
      onCreate();
      onClose();
    } catch (error: any) {
      console.error("Error creating form:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create form",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{template.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Project <span className="text-destructive">*</span>
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template.fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label className="text-base font-semibold">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              
              {field.type === "textarea" ? (
                <Textarea
                  value={formData[field.name] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [field.name]: e.target.value })
                  }
                  className="min-h-[80px]"
                  required={field.required}
                />
              ) : field.type === "select" ? (
                <Select
                  value={formData[field.name] || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, [field.name]: value })
                  }
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.name === "ppe_compliance" && (
                      <>
                        <SelectItem value="full">Full Compliance</SelectItem>
                        <SelectItem value="partial">Partial Compliance</SelectItem>
                        <SelectItem value="none">Non-Compliant</SelectItem>
                      </>
                    )}
                    {field.name === "hazard_type" && (
                      <>
                        <SelectItem value="fall">Fall Hazard</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="chemical">Chemical</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </>
                    )}
                    {field.name === "severity" && (
                      <>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </>
                    )}
                    {field.name === "incident_type" && (
                      <>
                        <SelectItem value="injury">Injury</SelectItem>
                        <SelectItem value="near_miss">Near Miss</SelectItem>
                        <SelectItem value="property_damage">Property Damage</SelectItem>
                        <SelectItem value="environmental">Environmental</SelectItem>
                      </>
                    )}
                    {field.name === "safety_briefing" && (
                      <>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={field.type}
                  value={formData[field.name] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [field.name]: e.target.value })
                  }
                  className="h-12"
                  required={field.required}
                />
              )}
            </div>
          ))}

          <div className="space-y-2">
            <Label className="text-base font-semibold">Photos</Label>
            <PhotoUpload
              photos={photos}
              onPhotosChange={setPhotos}
              maxPhotos={10}
              disabled={loading}
            />
          </div>

          <SignatureCapture
            label="Supervisor Signature"
            signature={signature}
            onSignatureChange={setSignature}
            disabled={loading}
          />

          <div className="flex justify-between gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              disabled={loading || saving}
              className="h-12"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </>
              )}
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="h-12"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="h-12 min-w-[120px]">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Form"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
