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
import { useSafetyLogAutoFill } from "@/hooks/useSafetyLogAutoFill";
import { Loader2, Save, Wand2, Copy, Cloud, Users, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [autoFillApplied, setAutoFillApplied] = useState(false);
  const { toast } = useToast();

  const {
    weather,
    crewCount,
    yesterdayLog,
    loading: autoFillLoading,
    fetchAll: fetchAutoFillData,
  } = useSafetyLogAutoFill(projectId || null);

  const template = formTemplates[formType] || formTemplates["daily_safety_log"];
  const isDailySafetyLog = formType === "daily_safety_log";

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
      setAutoFillApplied(false);
    }
  }, [isOpen, formType]);

  // Fetch auto-fill data when project is selected
  useEffect(() => {
    if (projectId && isDailySafetyLog && isOpen) {
      fetchAutoFillData();
    }
  }, [projectId, isDailySafetyLog, isOpen, fetchAutoFillData]);

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

  const handleAutoFill = () => {
    const updates: Record<string, string> = {};
    
    if (weather) {
      updates.weather = weather.description;
    }
    
    if (crewCount !== null) {
      updates.crew_count = crewCount.toString();
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
    setAutoFillApplied(true);
    
    const filledFields = [];
    if (weather) filledFields.push('weather');
    if (crewCount !== null) filledFields.push('crew count');
    
    if (filledFields.length > 0) {
      toast({
        title: "Auto-filled",
        description: `Updated: ${filledFields.join(', ')}`,
      });
    } else {
      toast({
        title: "No data available",
        description: "Could not auto-fill. Try selecting a project with check-ins.",
        variant: "destructive",
      });
    }
  };

  const handleCopyFromYesterday = () => {
    if (!yesterdayLog) {
      toast({
        title: "No previous log found",
        description: "No safety log from yesterday exists for this project.",
        variant: "destructive",
      });
      return;
    }

    // Copy relevant fields, but keep today's date and fresh weather/crew count
    const updates: Record<string, string> = {};
    
    // Copy hazards if they existed (they might still be relevant)
    if (yesterdayLog.hazards_identified) {
      updates.hazards_identified = `[From yesterday] ${yesterdayLog.hazards_identified}`;
    }
    
    // Copy PPE compliance as default
    if (yesterdayLog.ppe_compliance) {
      updates.ppe_compliance = yesterdayLog.ppe_compliance;
    }
    
    // Don't copy incidents - those are day-specific
    // Don't copy corrective actions - those should be confirmed as still needed
    
    setFormData(prev => ({ ...prev, ...updates }));
    
    toast({
      title: "Copied from yesterday",
      description: "Hazards and PPE compliance carried forward. Review and update as needed.",
    });
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

          {/* AI Auto-fill Section - Only for Daily Safety Log */}
          {isDailySafetyLog && projectId && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Quick Fill</span>
                </div>
                {autoFillLoading && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </Badge>
                )}
              </div>
              
              {/* Available data indicators */}
              <div className="flex flex-wrap gap-2">
                {weather && (
                  <Badge variant="outline" className="gap-1.5">
                    <Cloud className="h-3 w-3" />
                    {weather.description}
                  </Badge>
                )}
                {crewCount !== null && crewCount > 0 && (
                  <Badge variant="outline" className="gap-1.5">
                    <Users className="h-3 w-3" />
                    {crewCount} checked in
                  </Badge>
                )}
                {yesterdayLog && (
                  <Badge variant="outline" className="gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    Yesterday's log available
                  </Badge>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoFill}
                  disabled={autoFillLoading || (!weather && crewCount === null)}
                  className="gap-1.5"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Auto-fill Weather & Crew
                </Button>
                
                {yesterdayLog && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyFromYesterday}
                    className="gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy from Yesterday
                  </Button>
                )}
              </div>
              
              {autoFillApplied && (
                <p className="text-xs text-muted-foreground">
                  Fields auto-filled. Review and adjust as needed.
                </p>
              )}
            </div>
          )}

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
