import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Camera } from "lucide-react";

interface SafetyForm {
  id: string;
  form_type: string;
  title: string;
  status: "draft" | "submitted" | "reviewed";
  inspection_date: string;
  created_at: string;
  attachments?: Array<{ id: string }>;
}

interface SafetyFormsListProps {
  forms: SafetyForm[];
  onFormClick: (id: string) => void;
}

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

export const SafetyFormsList = ({ forms, onFormClick }: SafetyFormsListProps) => {
  return (
    <div className="space-y-3">
      {forms.map((form) => (
        <Card
          key={form.id}
          className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onFormClick(form.id)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <h3 className="font-semibold text-foreground truncate">
                  {form.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-sm">
                <Badge variant="outline" className="text-xs">
                  {getFormTypeLabel(form.form_type)}
                </Badge>
                <span className="text-muted-foreground">
                  {format(new Date(form.inspection_date), "MMM d, yyyy")}
                </span>
                {form.attachments && form.attachments.length > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    <span className="text-xs">{form.attachments.length}</span>
                  </div>
                )}
              </div>
            </div>

            <Badge className={getStatusColor(form.status)}>
              {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
};
