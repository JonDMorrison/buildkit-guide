import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  HardHat,
  AlertTriangle,
  Lock,
  Eye,
  GraduationCap,
  Brush,
  Shield,
} from "lucide-react";

export interface ControlOption {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const CONTROL_OPTIONS: ControlOption[] = [
  { id: "guardrails", label: "Guardrails", icon: <Shield className="h-3.5 w-3.5" /> },
  { id: "ppe", label: "PPE", icon: <HardHat className="h-3.5 w-3.5" /> },
  { id: "signage", label: "Signage", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: "lockout", label: "Lockout", icon: <Lock className="h-3.5 w-3.5" /> },
  { id: "spotter", label: "Spotter", icon: <Eye className="h-3.5 w-3.5" /> },
  { id: "training", label: "Training", icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { id: "housekeeping", label: "Housekeeping", icon: <Brush className="h-3.5 w-3.5" /> },
  { id: "other", label: "Other", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

interface ControlChipsProps {
  selectedControls: string[];
  onToggle: (controlId: string) => void;
  className?: string;
}

export const ControlChips = ({ selectedControls, onToggle, className }: ControlChipsProps) => {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {CONTROL_OPTIONS.map((control) => {
        const isSelected = selectedControls.includes(control.id);
        return (
          <Badge
            key={control.id}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer px-3 py-2 h-10 text-sm font-medium transition-all",
              "active:scale-95 touch-manipulation select-none",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent"
            )}
            onClick={() => onToggle(control.id)}
          >
            {control.icon}
            <span className="ml-1.5">{control.label}</span>
          </Badge>
        );
      })}
    </div>
  );
};
