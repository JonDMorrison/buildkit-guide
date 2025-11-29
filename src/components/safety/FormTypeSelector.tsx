import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Users,
  AlertTriangle,
  FileWarning,
  UserCheck,
} from "lucide-react";

interface FormTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: string) => void;
}

const formTypes = [
  {
    type: "daily_safety_log",
    label: "Daily Safety Log",
    description: "Document daily site conditions and safety checks",
    icon: ClipboardList,
  },
  {
    type: "toolbox_meeting",
    label: "Toolbox Meeting",
    description: "Record weekly safety meeting discussions",
    icon: Users,
  },
  {
    type: "hazard_id",
    label: "Hazard Identification",
    description: "Report potential hazards on site",
    icon: AlertTriangle,
  },
  {
    type: "incident_report",
    label: "Incident Report",
    description: "Document incidents and near misses",
    icon: FileWarning,
  },
  {
    type: "visitor_log",
    label: "Visitor Log",
    description: "Track site visitors and safety briefings",
    icon: UserCheck,
  },
];

export const FormTypeSelector = ({
  isOpen,
  onClose,
  onSelectType,
}: FormTypeSelectorProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Select Form Type</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formTypes.map((formType) => {
            const Icon = formType.icon;
            return (
              <Button
                key={formType.type}
                variant="outline"
                onClick={() => {
                  onSelectType(formType.type);
                  onClose();
                }}
                className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-accent"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-semibold text-left">{formType.label}</span>
                </div>
                <p className="text-xs text-muted-foreground text-left">
                  {formType.description}
                </p>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
