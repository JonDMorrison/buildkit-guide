import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { SignatureCapture } from "./SignatureCapture";
import { useToast } from "@/hooks/use-toast";
import { useSafetyFormSubmit } from "@/hooks/useSafetyFormSubmit";
import { Loader2, AlertTriangle, MapPin, Calendar, FileText, Shield, CheckCircle } from "lucide-react";
import { useCurrentProject } from "@/hooks/useCurrentProject";

interface NearMissFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  projectId?: string | null;
}

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low - Minor inconvenience" },
  { value: "medium", label: "Medium - Could cause injury" },
  { value: "high", label: "High - Could cause serious injury" },
  { value: "critical", label: "Critical - Could be fatal" },
];

export const NearMissForm = ({
  isOpen,
  onClose,
  onSuccess,
  projectId: propProjectId,
}: NearMissFormProps) => {
  const { currentProjectId } = useCurrentProject();
  const projectId = propProjectId || currentProjectId;
  const { toast } = useToast();
  const { submitting, submitForm } = useSafetyFormSubmit();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    location: "",
    description: "",
    potential_severity: "",
    suggested_controls: "",
  });
  const [signature, setSignature] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.date || !formData.location || !formData.description) {
      toast({
        title: "Required Fields Missing",
        description: "Please fill in date, location, and description.",
        variant: "destructive",
      });
      return;
    }

    if (!projectId) {
      toast({
        title: "No Project Selected",
        description: "Please select a project first.",
        variant: "destructive",
      });
      return;
    }

    // Build entries array
    const entries = [
      { field_name: "date", field_value: formData.date },
      { field_name: "time", field_value: formData.time },
      { field_name: "location", field_value: formData.location },
      { field_name: "description", field_value: formData.description },
    ];

    // Add optional fields if provided
    if (formData.potential_severity) {
      entries.push({ field_name: "potential_severity", field_value: formData.potential_severity });
    }
    if (formData.suggested_controls) {
      entries.push({ field_name: "suggested_controls", field_value: formData.suggested_controls });
    }
    if (signature) {
      entries.push({ field_name: "reporter_signature", field_value: signature });
    }

    const result = await submitForm({
      form: {
        projectId,
        formType: 'near_miss',
        title: `Near Miss - ${formData.location} - ${formData.date}`,
        inspectionDate: formData.date,
      },
      entries,
      successMessage: 'Thank you for reporting. Your report helps keep everyone safe.',
    });

    if (result) {
      // Reset form
      setFormData({
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().slice(0, 5),
        location: "",
        description: "",
        potential_severity: "",
        suggested_controls: "",
      });
      setSignature(null);

      onSuccess?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Report Near Miss
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Encouragement message */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Reporting near misses prevents future incidents
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Quick and easy - only 3 required fields
                </p>
              </div>
            </div>
          </div>

          {/* Required Fields */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  Date *
                </Label>
                <DatePicker
                  value={formData.date}
                  onChange={(v) => handleChange("date", v)}
                  placeholder="Select date"
                />
              </div>
              <div className="w-32">
                <Label className="mb-2 block">Time</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleChange("time", e.target.value)}
                  className="min-h-[52px]"
                />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4" />
                Location *
              </Label>
              <Input
                placeholder="e.g., Level 3, Stairwell B"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                required
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" />
                What happened? *
              </Label>
              <Textarea
                placeholder="Describe what happened and what could have gone wrong..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">Optional (but helpful)</p>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Potential Severity
              </Label>
              <Select
                value={formData.potential_severity}
                onValueChange={(value) => handleChange("potential_severity", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="How bad could it have been?" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                Suggested Controls
              </Label>
              <Textarea
                placeholder="Any ideas to prevent this in the future?"
                value={formData.suggested_controls}
                onChange={(e) => handleChange("suggested_controls", e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Signature */}
          <div className="border-t pt-4">
            <SignatureCapture
              label="Your Signature (optional)"
              signature={signature}
              onSignatureChange={setSignature}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formData.date || !formData.location || !formData.description}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};