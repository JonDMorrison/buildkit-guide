import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface SystemIssue {
  id: string;
  category: 'finance' | 'workflow' | 'config';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action_label: string;
  action_url: string;
}

interface IssueRowProps {
  issue: SystemIssue;
}

const severityAccent: Record<string, string> = {
  critical: 'border-l-destructive',
  warning: 'border-l-status-warning',
  info: 'border-l-muted-foreground/40',
};

export function IssueRow({ issue }: IssueRowProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(issue.action_url)}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/40 border-l-2 rounded-r-md",
        severityAccent[issue.severity]
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{issue.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{issue.description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <span className="text-xs text-primary font-medium hidden sm:inline">{issue.action_label}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </button>
  );
}
